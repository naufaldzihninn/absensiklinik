/* =====================================================
   Sistem Absensi Cerdas — Klinik Prima Insani
   Backend API Server (Express.js)
   ===================================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──
app.use(cors({
    origin: '*', // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // Allow large payloads for face photos
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // max 100 requests per windowMs
    message: { error: 'Terlalu banyak request. Coba lagi nanti.' }
});
app.use('/api/', limiter);

// Stricter rate limit for auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }
});

// ── Serve Frontend Static Files ──
const frontendRoot = path.join(__dirname, '..');
app.use('/pegawai', express.static(path.join(frontendRoot, 'pegawai')));
app.use('/admin', express.static(path.join(frontendRoot, 'admin')));
app.use('/shared', express.static(path.join(frontendRoot, 'shared')));
app.use(express.static(frontendRoot, { index: 'index.html' }));

// ── Public Routes (no auth required) ──
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Holiday endpoints (public)
const { getHolidays, isHoliday } = require('./utils/holidays');

app.get('/api/holidays', (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    res.json({ data: getHolidays(year), year });
});

app.get('/api/holidays/check', (req, res) => {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const result = isHoliday(date);
    res.json(result);
});

app.get('/api/server-time', (req, res) => {
    res.json({ time: new Date().toISOString() });
});

// ── Authenticated Routes ──
const authRoutes = require('./routes/auth');
const pegawaiRoutes = require('./routes/pegawai');
const absensiRoutes = require('./routes/absensi');
const faceRoutes = require('./routes/face');
const settingsRoutes = require('./routes/settings');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/pegawai', pegawaiRoutes);
app.use('/api/absensi', absensiRoutes);
app.use('/api/face', faceRoutes);
app.use('/api', settingsRoutes);

// ── 404 Handler ──
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// ── Error Handler ──
app.use((err, req, res, next) => {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
});

// ── Start Server ──
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`\n🏥 Absensi API Server running on port ${PORT}`);
        console.log(`   PWA:    http://localhost:${PORT}/pegawai/login.html`);
        console.log(`   Admin:  http://localhost:${PORT}/admin/login.html`);
        console.log(`   Health: http://localhost:${PORT}/api/health`);
        console.log(`   Env: ${process.env.NODE_ENV || 'development'}\n`);
    });
}

// Export for serverless (Vercel)
module.exports = app;
