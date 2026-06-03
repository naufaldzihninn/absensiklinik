/* =====================================================
   Settings Routes — Klinik, Shift, Audit Log
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const { cleanString, cleanNumber, cleanInteger, cleanTime, cleanLimit, cleanOffset } = require('../utils/validation');

// All routes require authentication
router.use(verifyToken);

// ─── Pengaturan Klinik ───

/**
 * GET /api/settings
 * Get clinic settings
 */
router.get('/settings', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pengaturan_klinik')
            .select('*')
            .limit(1)
            .single();

        if (error) throw error;
        res.json({ data });
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: 'Gagal mengambil pengaturan.' });
    }
});

/**
 * PUT /api/settings
 * Update clinic settings (Admin only)
 * Body: { nama_klinik?, latitude?, longitude?, batas_radius_meter? }
 */
router.put('/settings', requireRole('admin'), async (req, res) => {
    try {
        const updates = {};
        if (req.body.nama_klinik !== undefined) {
            const nama = cleanString(req.body.nama_klinik, 255);
            if (!nama) return res.status(400).json({ error: 'Nama klinik tidak valid.' });
            updates.nama_klinik = nama;
        }

        if (req.body.latitude !== undefined) {
            const latitude = cleanNumber(req.body.latitude, -90, 90);
            if (latitude === null) return res.status(400).json({ error: 'Latitude tidak valid.' });
            updates.latitude = latitude;
        }

        if (req.body.longitude !== undefined) {
            const longitude = cleanNumber(req.body.longitude, -180, 180);
            if (longitude === null) return res.status(400).json({ error: 'Longitude tidak valid.' });
            updates.longitude = longitude;
        }

        if (req.body.batas_radius_meter !== undefined) {
            const radius = cleanInteger(req.body.batas_radius_meter, 5, 5000);
            if (radius === null) return res.status(400).json({ error: 'Radius harus angka 5-5000 meter.' });
            updates.batas_radius_meter = radius;
        }

        updates.updated_by = req.user.id_pegawai;
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('pengaturan_klinik')
            .update(updates)
            .eq('id', 1)
            .select('*')
            .single();

        if (error) throw error;

        // Audit log
        await supabase.from('audit_log').insert({
            id_admin: req.user.id_pegawai,
            aksi: 'UPDATE_SETTING',
            detail: { changes: updates }
        });

        res.json({ data, message: 'Pengaturan berhasil disimpan.' });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Gagal menyimpan pengaturan.' });
    }
});

// ─── Shift ───

/**
 * GET /api/shift
 * List all shifts
 */
router.get('/shift', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('master_shift')
            .select('*')
            .order('id_shift');

        if (error) throw error;
        res.json({ data });
    } catch (err) {
        console.error('Get shifts error:', err);
        res.status(500).json({ error: 'Gagal mengambil data shift.' });
    }
});

/**
 * PUT /api/shift/:id
 * Update shift configuration (Admin only)
 */
router.put('/shift/:id', requireRole('admin'), async (req, res) => {
    try {
        const id = cleanInteger(req.params.id, 1, 9999);
        if (id === null) {
            return res.status(400).json({ error: 'ID shift tidak valid.' });
        }

        const updates = {};

        if (req.body.nama_shift !== undefined) {
            const nama = cleanString(req.body.nama_shift, 50);
            if (!nama) return res.status(400).json({ error: 'Nama shift tidak valid.' });
            updates.nama_shift = nama;
        }

        if (req.body.batas_jam_mulai_scan !== undefined) {
            const time = cleanTime(req.body.batas_jam_mulai_scan);
            if (!time) return res.status(400).json({ error: 'Batas jam mulai scan tidak valid.' });
            updates.batas_jam_mulai_scan = time;
        }

        if (req.body.batas_jam_akhir_scan !== undefined) {
            const time = cleanTime(req.body.batas_jam_akhir_scan);
            if (!time) return res.status(400).json({ error: 'Batas jam akhir scan tidak valid.' });
            updates.batas_jam_akhir_scan = time;
        }

        if (req.body.jam_masuk_ideal !== undefined) {
            const time = cleanTime(req.body.jam_masuk_ideal);
            if (!time) return res.status(400).json({ error: 'Jam masuk ideal tidak valid.' });
            updates.jam_masuk_ideal = time;
        }

        if (req.body.jam_pulang_ideal !== undefined) {
            const time = cleanTime(req.body.jam_pulang_ideal);
            if (!time) return res.status(400).json({ error: 'Jam pulang ideal tidak valid.' });
            updates.jam_pulang_ideal = time;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang diubah.' });
        }

        const { data, error } = await supabase
            .from('master_shift')
            .update(updates)
            .eq('id_shift', id)
            .select('*')
            .single();

        if (error) throw error;

        // Audit log
        await supabase.from('audit_log').insert({
            id_admin: req.user.id_pegawai,
            aksi: 'UPDATE_SHIFT',
            detail: { id_shift: id, changes: updates }
        });

        res.json({ data, message: 'Konfigurasi shift berhasil disimpan.' });
    } catch (err) {
        console.error('Update shift error:', err);
        res.status(500).json({ error: 'Gagal menyimpan konfigurasi shift.' });
    }
});

// ─── Audit Log ───

/**
 * GET /api/audit-log
 * List audit log entries (Admin only)
 * Query: ?limit=50&offset=0&aksi=CREATE_PEGAWAI
 */
router.get('/audit-log', requireRole('admin'), async (req, res) => {
    try {
        const limit = cleanLimit(req.query.limit, 50, 200);
        const offset = cleanOffset(req.query.offset);

        let query = supabase
            .from('audit_log')
            .select(`
        id_log,
        aksi,
        detail,
        created_at,
        pegawai:id_admin ( nama_lengkap )
      `)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (req.query.aksi) {
            query = query.eq('aksi', req.query.aksi);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Flatten admin name
        const logs = data.map(log => ({
            ...log,
            admin_name: log.pegawai?.nama_lengkap || 'System',
            pegawai: undefined
        }));

        res.json({ data: logs });
    } catch (err) {
        console.error('Get audit log error:', err);
        res.status(500).json({ error: 'Gagal mengambil audit log.' });
    }
});

module.exports = router;
