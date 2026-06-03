/* =====================================================
   Absensi Routes — Clock In/Out, History, Stats
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const { normalizeDescriptor, compareDescriptors } = require('../utils/face-match');
const { cleanLimit, cleanUuid } = require('../utils/validation');

// All routes require authentication
router.use(verifyToken);

// WIB = UTC+7
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const attendanceLocks = new Map();

/**
 * Get current time in WIB (UTC+7), regardless of server timezone.
 */
function nowWIB() {
    return new Date(Date.now() + WIB_OFFSET_MS);
}

function getWIBDayRange(wibDate = nowWIB()) {
    const startWib = new Date(wibDate);
    startWib.setUTCHours(0, 0, 0, 0);

    const startUtc = new Date(startWib.getTime() - WIB_OFFSET_MS);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

    return { startUtc, endUtc };
}

async function withAttendanceLock(key, task) {
    const previous = attendanceLocks.get(key) || Promise.resolve();
    let release;
    const next = new Promise(resolve => {
        release = resolve;
    });
    const queued = previous.catch(() => {}).then(() => next);
    attendanceLocks.set(key, queued);

    await previous.catch(() => {});

    try {
        return await task();
    } finally {
        release();
        if (attendanceLocks.get(key) === queued) {
            attendanceLocks.delete(key);
        }
    }
}

/**
 * Detect shift based on current WIB hour
 * 04:00–11:59 = Shift 1 (Pagi), 12:00-20:00 = Shift 2 (Siang)
 */
async function detectShift(hour) {
    const { data: shifts } = await supabase
        .from('master_shift')
        .select('*')
        .order('id_shift');

    if (!shifts || shifts.length === 0) return null;

    for (const shift of shifts) {
        const [startH, startM] = shift.batas_jam_mulai_scan.split(':').map(Number);
        const [endH, endM] = shift.batas_jam_akhir_scan.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        if (hour >= startMin && hour <= endMin) return shift;
    }

    return null;
}

/**
 * Calculate lateness status
 */
function calculateStatus(clockInTime, idealTime) {
    const clockIn = new Date(`1970-01-01T${clockInTime}`);
    const ideal = new Date(`1970-01-01T${idealTime}`);
    return clockIn <= ideal ? 'Tepat Waktu' : 'Terlambat';
}

/**
 * Calculate Haversine distance (meters)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeCoordinate(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
        return null;
    }
    return number;
}

async function validateAttendanceLocation(latitude, longitude) {
    const lat = normalizeCoordinate(latitude, -90, 90);
    const lng = normalizeCoordinate(longitude, -180, 180);

    if (lat === null || lng === null) {
        return {
            ok: false,
            status: 400,
            error: 'Koordinat GPS wajib valid. Aktifkan izin lokasi lalu coba lagi.'
        };
    }

    const { data: settings, error } = await supabase
        .from('pengaturan_klinik')
        .select('latitude, longitude, batas_radius_meter')
        .limit(1)
        .single();

    if (error || !settings) {
        return {
            ok: false,
            status: 500,
            error: 'Pengaturan lokasi klinik belum tersedia.'
        };
    }

    const jarak = Math.round(haversineDistance(
        lat,
        lng,
        parseFloat(settings.latitude),
        parseFloat(settings.longitude)
    ));

    if (jarak > settings.batas_radius_meter) {
        return {
            ok: false,
            status: 403,
            error: `Anda di luar radius klinik (${jarak}m / max ${settings.batas_radius_meter}m).`
        };
    }

    return { ok: true, latitude: lat, longitude: lng, jarak };
}

function isDuplicateAttendanceError(error) {
    if (error?.code !== '23505') return false;
    const text = [error.message, error.details, error.hint]
        .filter(Boolean)
        .join(' ');
    return text.includes('idx_log_absensi_unique_daily_shift');
}

async function verifyAttendanceFace(userId, descriptor) {
    const normalizedDescriptor = normalizeDescriptor(descriptor);
    if (!normalizedDescriptor) {
        return {
            ok: false,
            status: 400,
            error: 'Data wajah live tidak valid. Silakan ulangi verifikasi wajah.'
        };
    }

    const { data: pegawai, error } = await supabase
        .from('pegawai')
        .select('vektor_wajah, status_wajah')
        .eq('id_pegawai', userId)
        .single();

    if (error || !pegawai || !pegawai.status_wajah || !pegawai.vektor_wajah) {
        return {
            ok: false,
            status: 400,
            error: 'Anda belum mendaftarkan wajah. Silakan registrasi wajah terlebih dahulu.'
        };
    }

    const result = compareDescriptors(normalizedDescriptor, pegawai.vektor_wajah);
    if (!result) {
        return {
            ok: false,
            status: 400,
            error: 'Data wajah tersimpan tidak valid. Hubungi admin untuk reset wajah.'
        };
    }

    if (!result.match) {
        return {
            ok: false,
            status: 403,
            error: `Verifikasi wajah gagal (kecocokan: ${(result.score * 100).toFixed(1)}%).`
        };
    }

    return { ok: true, result };
}

/**
 * POST /api/absensi/clock-in
 * Body: { latitude, longitude, descriptor }
 */
router.post('/clock-in', async (req, res) => {
    try {
        const { latitude, longitude, descriptor } = req.body;
        const userId = req.user.id_pegawai;
        const nowUtc = new Date();          // Real UTC — used for DB storage
        const nowWib = nowWIB();            // WIB — used for shift/status logic only
        // Total WIB minutes from midnight for precise shift matching
        const currentHourMin = nowWib.getUTCHours() * 60 + nowWib.getUTCMinutes();
        const currentTime = `${String(nowWib.getUTCHours()).padStart(2,'0')}:${String(nowWib.getUTCMinutes()).padStart(2,'0')}:${String(nowWib.getUTCSeconds()).padStart(2,'0')}`;

        // 1. Verify face on the server before accepting attendance data
        const faceCheck = await verifyAttendanceFace(userId, descriptor);
        if (!faceCheck.ok) {
            return res.status(faceCheck.status).json({ error: faceCheck.error });
        }

        // 2. Detect shift
        const shift = await detectShift(currentHourMin);
        if (!shift) {
            return res.status(400).json({ error: 'Di luar jam operasional shift. Tidak bisa clock-in.' });
        }

        // 3. Check for duplicate clock-in today (use WIB date boundaries)
        const { startUtc: todayStartRealUtc, endUtc: todayEndRealUtc } = getWIBDayRange(nowWib);

        const lockKey = `${userId}:MASUK:${shift.id_shift}:${todayStartRealUtc.toISOString()}`;
        return await withAttendanceLock(lockKey, async () => {
            const { data: existing } = await supabase
                .from('log_absensi')
                .select('id_absen')
                .eq('id_pegawai', userId)
                .eq('tipe_absen', 'MASUK')
                .eq('id_shift', shift.id_shift)
                .gte('waktu_absen', todayStartRealUtc.toISOString())
                .lte('waktu_absen', todayEndRealUtc.toISOString())
                .limit(1);

            if (existing && existing.length > 0) {
                return res.status(409).json({ error: 'Anda sudah melakukan clock-in untuk shift ini hari ini.' });
            }

            // 4. Validate GPS distance
            const locationCheck = await validateAttendanceLocation(latitude, longitude);
            if (!locationCheck.ok) {
                return res.status(locationCheck.status).json({ error: locationCheck.error });
            }

            // 5. Calculate lateness
            const status = calculateStatus(currentTime, shift.jam_masuk_ideal);

            // 6. Insert attendance record
            const { data: record, error } = await supabase
                .from('log_absensi')
                .insert({
                    id_pegawai: userId,
                    id_shift: shift.id_shift,
                    tipe_absen: 'MASUK',
                    waktu_absen: nowUtc.toISOString(),  // Store real UTC — frontend converts to WIB
                    koordinat_absen: `${locationCheck.latitude}, ${locationCheck.longitude}`,
                    jarak_meter: locationCheck.jarak,
                    status_kehadiran: status,
                    akurasi_wajah: faceCheck.result.score
                })
                .select('*')
                .single();

            if (error) {
                if (isDuplicateAttendanceError(error)) {
                    return res.status(409).json({ error: 'Anda sudah melakukan clock-in untuk shift ini hari ini.' });
                }
                throw error;
            }

            return res.status(201).json({
                data: record,
                message: `Clock-in berhasil! Shift ${shift.nama_shift} — ${status}`,
                shift: shift.nama_shift,
                status,
                face: faceCheck.result
            });
        });

    } catch (err) {
        console.error('Clock-in error:', err);
        res.status(500).json({ error: 'Gagal melakukan clock-in.' });
    }
});

/**
 * POST /api/absensi/clock-out
 * Body: { latitude, longitude, descriptor }
 */
router.post('/clock-out', async (req, res) => {
    try {
        const { latitude, longitude, descriptor } = req.body;
        const userId = req.user.id_pegawai;
        const nowUtc = new Date();          // Real UTC — for DB storage
        const nowWib = nowWIB();            // WIB — for date boundary logic

        // 1. Verify face on the server before accepting attendance data
        const faceCheck = await verifyAttendanceFace(userId, descriptor);
        if (!faceCheck.ok) {
            return res.status(faceCheck.status).json({ error: faceCheck.error });
        }

        // 2. Find today's clock-in to determine shift (WIB date boundaries → real UTC)
        const { startUtc: todayStartRealUtc, endUtc: todayEndRealUtc } = getWIBDayRange(nowWib);

        const { data: clockIn } = await supabase
            .from('log_absensi')
            .select('id_shift')
            .eq('id_pegawai', userId)
            .eq('tipe_absen', 'MASUK')
            .gte('waktu_absen', todayStartRealUtc.toISOString())
            .lte('waktu_absen', todayEndRealUtc.toISOString())
            .order('waktu_absen', { ascending: false })
            .limit(1)
            .single();

        if (!clockIn) {
            return res.status(400).json({ error: 'Anda belum clock-in hari ini.' });
        }

        const lockKey = `${userId}:PULANG:${clockIn.id_shift}:${todayStartRealUtc.toISOString()}`;
        return await withAttendanceLock(lockKey, async () => {
            // 3. Check for duplicate clock-out
            const { data: existingOut } = await supabase
                .from('log_absensi')
                .select('id_absen')
                .eq('id_pegawai', userId)
                .eq('tipe_absen', 'PULANG')
                .eq('id_shift', clockIn.id_shift)
                .gte('waktu_absen', todayStartRealUtc.toISOString())
                .lte('waktu_absen', todayEndRealUtc.toISOString())
                .limit(1);

            if (existingOut && existingOut.length > 0) {
                return res.status(409).json({ error: 'Anda sudah clock-out untuk shift ini.' });
            }

            // 4. Validate GPS distance
            const locationCheck = await validateAttendanceLocation(latitude, longitude);
            if (!locationCheck.ok) {
                return res.status(locationCheck.status).json({ error: locationCheck.error });
            }

            // 5. Insert clock-out record
            const { data: record, error } = await supabase
                .from('log_absensi')
                .insert({
                    id_pegawai: userId,
                    id_shift: clockIn.id_shift,
                    tipe_absen: 'PULANG',
                    waktu_absen: nowUtc.toISOString(),  // Store real UTC
                    koordinat_absen: `${locationCheck.latitude}, ${locationCheck.longitude}`,
                    jarak_meter: locationCheck.jarak,
                    status_kehadiran: '-',
                    akurasi_wajah: faceCheck.result.score
                })
                .select('*')
                .single();

            if (error) {
                if (isDuplicateAttendanceError(error)) {
                    return res.status(409).json({ error: 'Anda sudah clock-out untuk shift ini.' });
                }
                throw error;
            }

            return res.status(201).json({
                data: record,
                message: 'Clock-out berhasil!',
                face: faceCheck.result
            });
        });

    } catch (err) {
        console.error('Clock-out error:', err);
        res.status(500).json({ error: 'Gagal melakukan clock-out.' });
    }
});

/**
 * GET /api/absensi/history
 * Get attendance history
 * Query: ?days=30 (default 30 days)
 * Admin can add ?id_pegawai=uuid to view specific employee
 */
router.get('/history', async (req, res) => {
    try {
        const days = cleanLimit(req.query.days, 30, 365);
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const requestedUserId = req.query.id_pegawai ? cleanUuid(req.query.id_pegawai) : null;
        if (req.query.id_pegawai && !requestedUserId) {
            return res.status(400).json({ error: 'ID pegawai tidak valid.' });
        }

        const targetUser = (req.user.role === 'admin' && requestedUserId)
            ? requestedUserId
            : req.user.id_pegawai;

        let query = supabase
            .from('log_absensi')
            .select(`
        id_absen, tipe_absen, waktu_absen, koordinat_absen, jarak_meter,
        status_kehadiran, akurasi_wajah,
        master_shift ( nama_shift ),
        pegawai ( nama_lengkap )
      `)
            .gte('waktu_absen', sinceDate.toISOString())
            .order('waktu_absen', { ascending: false });

        // Non-admin can only see own records
        if (req.user.role !== 'admin' || requestedUserId) {
            query = query.eq('id_pegawai', targetUser);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Flatten nested data
        const records = data.map(r => ({
            ...r,
            nama_shift: r.master_shift?.nama_shift || '-',
            nama_pegawai: r.pegawai?.nama_lengkap || '-',
            master_shift: undefined,
            pegawai: undefined
        }));

        res.json({ data: records });

    } catch (err) {
        console.error('Get history error:', err);
        res.status(500).json({ error: 'Gagal mengambil riwayat absensi.' });
    }
});

/**
 * GET /api/absensi/today
 * Get today's attendance stats (Admin only)
 */
router.get('/today', requireRole('admin'), async (req, res) => {
    try {
        const { startUtc: todayStart, endUtc: todayEnd } = getWIBDayRange();

        // Get today's clock-in records
        const { data: todayRecords } = await supabase
            .from('log_absensi')
            .select(`
        id_absen, id_pegawai, tipe_absen, waktu_absen,
        status_kehadiran, akurasi_wajah, jarak_meter, koordinat_absen,
        master_shift ( nama_shift ),
        pegawai ( nama_lengkap )
      `)
            .gte('waktu_absen', todayStart.toISOString())
            .lte('waktu_absen', todayEnd.toISOString())
            .order('waktu_absen', { ascending: false });

        // Get total active employees
        const { count: totalPegawai } = await supabase
            .from('pegawai')
            .select('id_pegawai', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('role', 'pegawai');

        // Calculate stats
        const clockIns = (todayRecords || []).filter(r => r.tipe_absen === 'MASUK');
        const uniquePresent = new Set(clockIns.map(r => r.id_pegawai));

        const stats = {
            totalPegawai: totalPegawai || 0,
            hadir: uniquePresent.size,
            tepat_waktu: clockIns.filter(r => r.status_kehadiran === 'Tepat Waktu').length,
            terlambat: clockIns.filter(r => r.status_kehadiran === 'Terlambat').length,
            alpa: (totalPegawai || 0) - uniquePresent.size
        };

        // Flatten records
        const records = (todayRecords || []).map(r => ({
            ...r,
            nama_shift: r.master_shift?.nama_shift || '-',
            nama_pegawai: r.pegawai?.nama_lengkap || '-',
            master_shift: undefined,
            pegawai: undefined
        }));

        res.json({ stats, data: records });

    } catch (err) {
        console.error('Get today stats error:', err);
        res.status(500).json({ error: 'Gagal mengambil statistik hari ini.' });
    }
});

/**
 * GET /api/absensi/weekly-trend
 * Get daily attendance tally for the last 5 working days (Admin only)
 */
router.get('/weekly-trend', requireRole('admin'), async (req, res) => {
    try {
        // Build list of last 5 weekdays (Mon-Fri) in WIB, including today
        const today = nowWIB();
        const weekdays = [];
        let d = new Date(today);
        while (weekdays.length < 5) {
            if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
                weekdays.unshift(new Date(d));
            }
            d.setUTCDate(d.getUTCDate() - 1);
        }

        const { startUtc: sinceDate } = getWIBDayRange(weekdays[0]);
        const { endUtc: untilDate } = getWIBDayRange(weekdays[weekdays.length - 1]);

        // Fetch all MASUK records in the range
        const { data: records, error } = await supabase
            .from('log_absensi')
            .select('id_pegawai, waktu_absen, status_kehadiran, tipe_absen')
            .eq('tipe_absen', 'MASUK')
            .gte('waktu_absen', sinceDate.toISOString())
            .lte('waktu_absen', untilDate.toISOString());

        if (error) throw error;

        const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const result = weekdays.map(day => {
            const { startUtc, endUtc } = getWIBDayRange(day);
            const dayRecords = (records || []).filter(r => {
                const time = new Date(r.waktu_absen);
                return time >= startUtc && time <= endUtc;
            });
            // Deduplicate per employee (take first record per person per day)
            const uniqueByEmployee = {};
            dayRecords.forEach(r => {
                if (!uniqueByEmployee[r.id_pegawai]) {
                    uniqueByEmployee[r.id_pegawai] = r;
                }
            });
            const allPresent = Object.values(uniqueByEmployee);
            return {
                label: dayNames[day.getUTCDay()],
                tepatWaktu: allPresent.filter(r => r.status_kehadiran === 'Tepat Waktu').length,
                terlambat: allPresent.filter(r => r.status_kehadiran === 'Terlambat').length,
            };
        });

        res.json({ data: result });

    } catch (err) {
        console.error('Weekly trend error:', err);
        res.status(500).json({ error: 'Gagal mengambil tren mingguan.' });
    }
});

module.exports = router;
