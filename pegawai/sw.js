// Service Worker — Absensi Klinik Prima Insani PWA
const CACHE_NAME = 'absensi-kpi-v9';
const OFFLINE_URL = '/pegawai/offline.html';

// Core assets to cache for offline shell
const ASSETS_TO_CACHE = [
    '/pegawai/css/style.css',
    '/pegawai/js/app.js',
    '/pegawai/js/api.js',
    '/pegawai/js/login.js',
    '/pegawai/js/offline.js',
    '/pegawai/js/riwayat.js',
    '/pegawai/js/profil.js',
    '/pegawai/js/index.js',
    '/pegawai/js/register-face.js',
    '/pegawai/js/absen.js',
    '/pegawai/js/camera.js',
    '/pegawai/js/geolocation.js',
    '/pegawai/js/face.js',
    '/pegawai/offline.html',
    '/shared/assets/logo.png'
];

// Install: cache essential assets + offline page
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching core assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first, fallback to cache, then offline page
self.addEventListener('fetch', (event) => {
    // Skip non-GET and API requests
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful responses for HTML, CSS, JS, images
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Serve from cache if offline
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // For HTML navigation requests, show offline page
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return caches.match(OFFLINE_URL);
                    }
                    return cached;
                });
            })
    );
});
