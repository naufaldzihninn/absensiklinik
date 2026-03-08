/* =====================================================
   Absensi Routes — Clock In/Out, History, Stats
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

/**
 * Detect shift based on current hour
 * 04:00–11:59 = Shift 1 (Pagi), 12:00-20:00 = Shift 2 (Siang)
 */
async function detectShift(hour) {
    const { data: shifts } = await supabase
        .from('master_shift')
        .select('*')
        .order('id_shift');

    if (!shifts || shifts.length === 0) return null;

    for (const shift of shifts) {
        const start = parseInt(shift.batas_jam_mulai_scan.split(':')[0]);
        const end = parseInt(shift.batas_jam_akhir_scan.split(':')[0]);
        if (hour >= start && hour <= end) return shift;
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

/**
 * POST /api/absensi/clock-in
 * Body: { latitude, longitude, akurasi_wajah? }
 */
router.post('/clock-in', async (req, res) => {
    try {
        const { latitude, longitude, akurasi_wajah = 0 } = req.body;
        const userId = req.user.id_pegawai;
        const now = new Date();
        const currentHour = now.getHours();
        const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

        // 1. Check if user has face registered
        const { data: pegawai } = await supabase
            .from('pegawai')
            .select('vektor_wajah, status_wajah')
            .eq('id_pegawai', userId)
            .single();

        if (!pegawai || !pegawai.vektor_wajah) {
            return res.status(400).json({ error: 'Anda belum mendaftarkan wajah. Silakan registrasi wajah terlebih dahulu.' });
        }

        // 2. Detect shift
        const shift = await detectShift(currentHour);
        if (!shift) {
            return res.status(400).json({ error: 'Di luar jam operasional shift. Tidak bisa clock-in.' });
        }

        // 3. Check for duplicate clock-in today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const { data: existing } = await supabase
            .from('log_absensi')
            .select('id_absen')
            .eq('id_pegawai', userId)
            .eq('tipe_absen', 'MASUK')
            .eq('id_shift', shift.id_shift)
            .gte('waktu_absen', todayStart.toISOString())
            .lte('waktu_absen', todayEnd.toISOString())
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(409).json({ error: 'Anda sudah melakukan clock-in untuk shift ini hari ini.' });
        }

        // 4. Validate GPS distance
        const { data: settings } = await supabase
            .from('pengaturan_klinik')
            .select('latitude, longitude, batas_radius_meter')
            .limit(1)
            .single();

        let jarak = 0;
        if (settings && latitude && longitude) {
            jarak = Math.round(haversineDistance(
                latitude, longitude,
                parseFloat(settings.latitude), parseFloat(settings.longitude)
            ));

            if (jarak > settings.batas_radius_meter) {
                return res.status(403).json({
                    error: `Anda di luar radius klinik (${jarak}m / max ${settings.batas_radius_meter}m).`
                });
            }
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
                waktu_absen: now.toISOString(),
                koordinat_absen: `${latitude}, ${longitude}`,
                jarak_meter: jarak,
                status_kehadiran: status,
                akurasi_wajah: akurasi_wajah
            })
            .select('*')
            .single();

        if (error) throw error;

        res.status(201).json({
            data: record,
            message: `Clock-in berhasil! Shift ${shift.nama_shift} — ${status}`,
            shift: shift.nama_shift,
            status
        });

    } catch (err) {
        console.error('Clock-in error:', err);
        res.status(500).json({ error: 'Gagal melakukan clock-in.' });
    }
});

/**
 * POST /api/absensi/clock-out
 * Body: { latitude, longitude, akurasi_wajah? }
 */
router.post('/clock-out', async (req, res) => {
    try {
        const { latitude, longitude, akurasi_wajah = 0 } = req.body;
        const userId = req.user.id_pegawai;
        const now = new Date();

        // 1. Find today's clock-in to determine shift
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const { data: clockIn } = await supabase
            .from('log_absensi')
            .select('id_shift')
            .eq('id_pegawai', userId)
            .eq('tipe_absen', 'MASUK')
            .gte('waktu_absen', todayStart.toISOString())
            .lte('waktu_absen', todayEnd.toISOString())
            .order('waktu_absen', { ascending: false })
            .limit(1)
            .single();

        if (!clockIn) {
            return res.status(400).json({ error: 'Anda belum clock-in hari ini.' });
        }

        // 2. Check for duplicate clock-out
        const { data: existingOut } = await supabase
            .from('log_absensi')
            .select('id_absen')
            .eq('id_pegawai', userId)
            .eq('tipe_absen', 'PULANG')
            .eq('id_shift', clockIn.id_shift)
            .gte('waktu_absen', todayStart.toISOString())
            .lte('waktu_absen', todayEnd.toISOString())
            .limit(1);

        if (existingOut && existingOut.length > 0) {
            return res.status(409).json({ error: 'Anda sudah clock-out untuk shift ini.' });
        }

        // 3. Calculate distance
        const { data: settings } = await supabase
            .from('pengaturan_klinik')
            .select('latitude, longitude, batas_radius_meter')
            .limit(1)
            .single();

        let jarak = 0;
        if (settings && latitude && longitude) {
            jarak = Math.round(haversineDistance(
                latitude, longitude,
                parseFloat(settings.latitude), parseFloat(settings.longitude)
            ));
        }

        // 4. Insert clock-out record
        const { data: record, error } = await supabase
            .from('log_absensi')
            .insert({
                id_pegawai: userId,
                id_shift: clockIn.id_shift,
                tipe_absen: 'PULANG',
                waktu_absen: now.toISOString(),
                koordinat_absen: `${latitude}, ${longitude}`,
                jarak_meter: jarak,
                status_kehadiran: '-',
                akurasi_wajah: akurasi_wajah
            })
            .select('*')
            .single();

        if (error) throw error;

        res.status(201).json({
            data: record,
            message: 'Clock-out berhasil!'
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
        const days = parseInt(req.query.days) || 30;
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const targetUser = (req.user.role === 'admin' && req.query.id_pegawai)
            ? req.query.id_pegawai
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
        if (req.user.role !== 'admin' || req.query.id_pegawai) {
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
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

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

module.exports = router;
