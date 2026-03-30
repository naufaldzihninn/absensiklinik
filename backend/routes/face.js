/* =====================================================
   Face Routes — Register & Reset Face Data
   (Face matching via face-api.js will be added later)
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

/**
 * POST /api/face/register
 * Register face descriptor (128-dimension vector)
 * Body: { descriptor: number[] }
 * 
 * Note: In production, the client extracts the face descriptor
 * using face-api.js in the browser, then sends just the 128-number
 * array to the server. This avoids uploading photos to the server
 * (zero-storage approach).
 */
router.post('/register', async (req, res) => {
    try {
        const { descriptor } = req.body;
        const userId = req.user.id_pegawai;

        if (!descriptor || !Array.isArray(descriptor)) {
            return res.status(400).json({ error: 'Data vektor wajah tidak valid.' });
        }

        if (descriptor.length !== 128) {
            return res.status(400).json({ error: 'Vektor wajah harus 128 dimensi.' });
        }

        // Save face descriptor to database
        const { data, error } = await supabase
            .from('pegawai')
            .update({
                vektor_wajah: descriptor,
                status_wajah: true
            })
            .eq('id_pegawai', userId)
            .select('id_pegawai, nama_lengkap, status_wajah')
            .single();

        if (error) throw error;

        res.json({
            data,
            message: 'Registrasi wajah berhasil! Anda sekarang bisa melakukan absensi.'
        });

    } catch (err) {
        console.error('Face register error:', err);
        res.status(500).json({ error: 'Gagal mendaftarkan wajah.' });
    }
});

/**
 * POST /api/face/match
 * Match face descriptor against stored master
 * Body: { descriptor: number[] }
 * Returns: { match: boolean, score: number }
 */
router.post('/match', async (req, res) => {
    try {
        const { descriptor } = req.body;
        const userId = req.user.id_pegawai;

        if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
            return res.status(400).json({ error: 'Data vektor wajah tidak valid.' });
        }

        // Get stored master descriptor
        const { data: pegawai } = await supabase
            .from('pegawai')
            .select('vektor_wajah')
            .eq('id_pegawai', userId)
            .single();

        if (!pegawai || !pegawai.vektor_wajah) {
            return res.status(400).json({ error: 'Wajah belum terdaftar.' });
        }

        // Calculate Euclidean distance between descriptors
        const master = pegawai.vektor_wajah;
        let sum = 0;
        for (let i = 0; i < 128; i++) {
            sum += (descriptor[i] - master[i]) ** 2;
        }
        const distance = Math.sqrt(sum);

        // Convert distance to similarity score (0-1)
        // Lower distance = higher similarity
        // Threshold 0.4 = requires ~60% similarity (more secure than default 0.6)
        const score = Math.max(0, 1 - distance);
        const match = distance < 0.35; // tightened: ~65% min displayed score

        res.json({
            match,
            score: parseFloat(score.toFixed(4)),
            distance: parseFloat(distance.toFixed(4)),
            threshold: 0.35
        });

    } catch (err) {
        console.error('Face match error:', err);
        res.status(500).json({ error: 'Gagal memverifikasi wajah.' });
    }
});

/**
 * DELETE /api/face/reset/:id
 * Reset face data for an employee (Admin only)
 */
router.delete('/reset/:id', requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('pegawai')
            .update({
                vektor_wajah: null,
                foto_master_url: null,
                status_wajah: false
            })
            .eq('id_pegawai', id)
            .select('id_pegawai, nama_lengkap')
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Pegawai tidak ditemukan.' });

        // Audit log
        await supabase.from('audit_log').insert({
            id_admin: req.user.id_pegawai,
            aksi: 'RESET_WAJAH',
            detail: { id_pegawai: id, nama: data.nama_lengkap }
        });

        res.json({ message: `Wajah "${data.nama_lengkap}" berhasil direset.` });

    } catch (err) {
        console.error('Face reset error:', err);
        res.status(500).json({ error: 'Gagal mereset wajah.' });
    }
});

module.exports = router;
