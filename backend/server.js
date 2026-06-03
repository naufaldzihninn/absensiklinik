/* =====================================================
   Sistem Absensi Cerdas — Klinik Prima Insani
   Backend API Server (Express.js)
   ===================================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

app.disable('x-powered-by');

// ── Middleware ──
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "https://cdn.jsdelivr.net",
                "https://unpkg.com",
                "https://cdnjs.cloudflare.com"
            ],
            scriptSrcAttr: ["'none'"],
            workerSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (!isProduction) return callback(null, true);
        return callback(null, allowedOrigins.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

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
const staticOptions = {
    etag: true,
    maxAge: isProduction ? '1h' : 0,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store');
        }
    }
};
app.use('/pegawai', express.static(path.join(frontendRoot, 'pegawai'), staticOptions));
app.use('/admin', express.static(path.join(frontendRoot, 'admin'), staticOptions));
app.use('/shared', express.static(path.join(frontendRoot, 'shared'), staticOptions));
app.use(express.static(frontendRoot, { ...staticOptions, index: 'index.html' }));

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
// Vercel imports the Express app from api/index.js. Render/local runs this file directly.
if (!process.env.VERCEL) {
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
