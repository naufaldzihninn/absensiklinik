/* =====================================================
   Auth Middleware — JWT Verification + Role Guard
   ===================================================== */

const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET harus diisi di environment.');
}

/**
 * Verify JWT token from Authorization header
 * Attaches decoded user data to req.user
 */
async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const { data: user, error } = await supabase
            .from('pegawai')
            .select('id_pegawai, username, nama_lengkap, role, is_active')
            .eq('id_pegawai', decoded.id_pegawai)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Akun tidak ditemukan. Silakan login ulang.' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan. Hubungi admin.' });
        }

        req.user = {
            id_pegawai: user.id_pegawai,
            username: user.username,
            nama_lengkap: user.nama_lengkap,
            role: user.role
        };
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token sudah kadaluarsa. Silakan login ulang.' });
        }
        return res.status(401).json({ error: 'Token tidak valid.' });
    }
}

/**
 * Role-based access guard
 * Usage: requireRole('admin') or requireRole('pegawai', 'admin')
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Tidak terautentikasi.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Anda tidak memiliki akses untuk fitur ini.' });
        }
        next();
    };
}

module.exports = { verifyToken, requireRole };
