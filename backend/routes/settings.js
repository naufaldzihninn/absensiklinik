/* =====================================================
   Settings Routes — Klinik, Shift, Audit Log
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');

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
        if (req.body.nama_klinik) updates.nama_klinik = req.body.nama_klinik;
        if (req.body.latitude !== undefined) updates.latitude = req.body.latitude;
        if (req.body.longitude !== undefined) updates.longitude = req.body.longitude;
        if (req.body.batas_radius_meter !== undefined) updates.batas_radius_meter = req.body.batas_radius_meter;
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
        const { id } = req.params;
        const updates = {};

        if (req.body.nama_shift) updates.nama_shift = req.body.nama_shift;
        if (req.body.batas_jam_mulai_scan) updates.batas_jam_mulai_scan = req.body.batas_jam_mulai_scan;
        if (req.body.batas_jam_akhir_scan) updates.batas_jam_akhir_scan = req.body.batas_jam_akhir_scan;
        if (req.body.jam_masuk_ideal) updates.jam_masuk_ideal = req.body.jam_masuk_ideal;
        if (req.body.jam_pulang_ideal) updates.jam_pulang_ideal = req.body.jam_pulang_ideal;

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
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

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
