/* =====================================================
   Auth Routes — Login / Logout
   ===================================================== */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d'; // Token valid for 7 days

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username dan password harus diisi.' });
        }

        // Find user by username
        const { data: user, error } = await supabase
            .from('pegawai')
            .select('id_pegawai, username, password, nama_lengkap, role, status_wajah, vektor_wajah, is_active')
            .eq('username', username.trim().toLowerCase())
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Username atau password salah.' });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan. Hubungi admin.' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Username atau password salah.' });
        }

        // Generate JWT
        const tokenPayload = {
            id_pegawai: user.id_pegawai,
            username: user.username,
            nama_lengkap: user.nama_lengkap,
            role: user.role
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Return user data (without password and vektor_wajah)
        res.json({
            token,
            user: {
                id_pegawai: user.id_pegawai,
                username: user.username,
                nama_lengkap: user.nama_lengkap,
                role: user.role,
                status_wajah: user.status_wajah,
                has_vektor: user.vektor_wajah !== null
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Terjadi kesalahan saat login.' });
    }
});

/**
 * POST /api/auth/logout
 * (Stateless JWT — just a confirmation endpoint)
 */
router.post('/logout', (req, res) => {
    // JWT is stateless, client should remove the token
    res.json({ message: 'Logout berhasil.' });
});

module.exports = router;
