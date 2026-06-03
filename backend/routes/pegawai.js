/* =====================================================
   Pegawai Routes — Employee CRUD (Admin Only)
   ===================================================== */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const { cleanUsername, cleanString, cleanRole, cleanBoolean, cleanUuid } = require('../utils/validation');

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/pegawai
 * List all employees (Admin only)
 */
router.get('/', requireRole('admin'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pegawai')
            .select('id_pegawai, username, nama_lengkap, role, foto_master_url, status_wajah, is_active, created_at, updated_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ data });
    } catch (err) {
        console.error('Get pegawai error:', err);
        res.status(500).json({ error: 'Gagal mengambil data pegawai.' });
    }
});

/**
 * GET /api/pegawai/me
 * Get current user's own profile
 */
router.get('/me', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pegawai')
            .select('id_pegawai, username, nama_lengkap, role, foto_master_url, status_wajah, is_active, created_at')
            .eq('id_pegawai', req.user.id_pegawai)
            .single();

        if (error) throw error;
        res.json({ data });
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Gagal mengambil profil.' });
    }
});

/**
 * POST /api/pegawai
 * Create new employee (Admin only)
 * Body: { username, password, nama_lengkap, role? }
 */
router.post('/', requireRole('admin'), async (req, res) => {
    try {
        const username = cleanUsername(req.body.username);
        const password = cleanString(req.body.password, 128);
        const nama_lengkap = cleanString(req.body.nama_lengkap, 255);
        const role = cleanRole(req.body.role || 'pegawai');

        if (!username || !password || !nama_lengkap) {
            return res.status(400).json({ error: 'Username, password, dan nama lengkap harus valid.' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password minimal 8 karakter.' });
        }

        if (!role) {
            return res.status(400).json({ error: 'Role harus pegawai atau admin.' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('pegawai')
            .insert({
                username: username.trim().toLowerCase(),
                password: hashedPassword,
                nama_lengkap,
                role
            })
            .select('id_pegawai, username, nama_lengkap, role, status_wajah, is_active, created_at')
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Username sudah digunakan.' });
            }
            throw error;
        }

        // Log audit
        await supabase.from('audit_log').insert({
            id_admin: req.user.id_pegawai,
            aksi: 'CREATE_PEGAWAI',
            detail: { id_pegawai: data.id_pegawai, nama: nama_lengkap }
        });

        res.status(201).json({ data, message: 'Pegawai berhasil ditambahkan.' });
    } catch (err) {
        console.error('Create pegawai error:', err);
        res.status(500).json({ error: 'Gagal menambahkan pegawai.' });
    }
});

/**
 * PUT /api/pegawai/:id
 * Update employee data (Admin only)
 * Body: { nama_lengkap?, role?, is_active? }
 */
router.put('/:id', requireRole('admin'), async (req, res) => {
    try {
        const id = cleanUuid(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'ID pegawai tidak valid.' });
        }

        const updates = {};

        if (req.body.nama_lengkap !== undefined) {
            const nama = cleanString(req.body.nama_lengkap, 255);
            if (!nama) return res.status(400).json({ error: 'Nama lengkap tidak valid.' });
            updates.nama_lengkap = nama;
        }

        if (req.body.role !== undefined) {
            const role = cleanRole(req.body.role);
            if (!role) return res.status(400).json({ error: 'Role harus pegawai atau admin.' });
            updates.role = role;
        }

        if (req.body.is_active !== undefined) {
            const isActive = cleanBoolean(req.body.is_active);
            if (isActive === null) return res.status(400).json({ error: 'Status aktif harus boolean.' });
            if (id === req.user.id_pegawai && !isActive) {
                return res.status(403).json({ error: 'Tidak bisa menonaktifkan akun sendiri.' });
            }
            updates.is_active = isActive;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Tidak ada data yang diubah.' });
        }

        const { data, error } = await supabase
            .from('pegawai')
            .update(updates)
            .eq('id_pegawai', id)
            .select('id_pegawai, username, nama_lengkap, role, status_wajah, is_active')
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Pegawai tidak ditemukan.' });

        // Log audit
        const aksi = typeof req.body.is_active === 'boolean'
            ? (req.body.is_active ? 'ACTIVATE_PEGAWAI' : 'DEACTIVATE_PEGAWAI')
            : 'UPDATE_PEGAWAI';

        await supabase.from('audit_log').insert({
            id_admin: req.user.id_pegawai,
            aksi,
            detail: { id_pegawai: id, changes: updates }
        });

        res.json({ data, message: 'Data pegawai berhasil diubah.' });
    } catch (err) {
        console.error('Update pegawai error:', err);
        res.status(500).json({ error: 'Gagal mengubah data pegawai.' });
    }
});

/**
 * DELETE /api/pegawai/:id
 * Soft-delete employee (Admin only)
 */
router.delete('/:id', requireRole('admin'), async (req, res) => {
    try {
        const id = cleanUuid(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'ID pegawai tidak valid.' });
        }

        if (req.user.id_pegawai === id) {
            return res.status(403).json({ error: 'Tidak bisa menonaktifkan akun sendiri.' });
        }

        const { data, error } = await supabase
            .from('pegawai')
            .update({ is_active: false })
            .eq('id_pegawai', id)
            .select('id_pegawai, nama_lengkap')
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Pegawai tidak ditemukan.' });

        // Log audit
        await supabase.from('audit_log').insert({
            id_admin: req.user.id_pegawai,
            aksi: 'DEACTIVATE_PEGAWAI',
            detail: { id_pegawai: id, nama: data.nama_lengkap }
        });

        res.json({ message: `Pegawai "${data.nama_lengkap}" berhasil dinonaktifkan.` });
    } catch (err) {
        console.error('Delete pegawai error:', err);
        res.status(500).json({ error: 'Gagal menghapus pegawai.' });
    }
});

/**
 * DELETE /api/pegawai/:id/permanent
 * Hard delete employee and all related records (Admin only)
 */
router.delete('/:id/permanent', requireRole('admin'), async (req, res) => {
    try {
        const id = cleanUuid(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'ID pegawai tidak valid.' });
        }

        // Prevent deleting yourself
        if (req.user.id_pegawai === id) {
            return res.status(403).json({ error: 'Tidak bisa menghapus akun sendiri.' });
        }

        // Get employee name first for audit
        const { data: emp } = await supabase
            .from('pegawai')
            .select('nama_lengkap')
            .eq('id_pegawai', id)
            .single();

        if (!emp) return res.status(404).json({ error: 'Pegawai tidak ditemukan.' });

        // Delete attendance records first
        await supabase.from('log_absensi').delete().eq('id_pegawai', id);

        // Hard delete employee
        const { error } = await supabase
            .from('pegawai')
            .delete()
            .eq('id_pegawai', id);

        if (error) throw error;

        // Audit log
        await supabase.from('audit_log').insert({
            id_admin: req.user.id_pegawai,
            aksi: 'DELETE_PEGAWAI',
            detail: { id_pegawai: id, nama: emp.nama_lengkap }
        });

        res.json({ message: `Pegawai "${emp.nama_lengkap}" berhasil dihapus permanen.` });
    } catch (err) {
        console.error('Permanent delete error:', err);
        res.status(500).json({ error: 'Gagal menghapus pegawai.' });
    }
});

module.exports = router;
