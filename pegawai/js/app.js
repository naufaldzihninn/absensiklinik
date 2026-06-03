/* =====================================================
   App Module — Main Application Logic
   ===================================================== */

const App = (() => {
    /**
     * Initialize the real-time clock display
     * @param {string} clockId - ID of the clock element
     * @param {string} dateId - ID of the date element
     */
    function initClock(clockId, dateId) {
        const clockEl = document.getElementById(clockId);
        const dateEl = document.getElementById(dateId);
        if (!clockEl) return;

        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

        function update() {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const mins = String(now.getMinutes()).padStart(2, '0');
            const secs = String(now.getSeconds()).padStart(2, '0');

            clockEl.innerHTML = `${hours}:${mins}<span class="clock-seconds">:${secs}</span>`;

            if (dateEl) {
                dateEl.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
            }
        }

        update();
        setInterval(update, 1000);
    }

    /**
     * Show a toast notification
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} type
     * @param {number} duration - Duration in ms
     */
    function showToast(message, type = 'info', duration = 3000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 250);
        }, duration);
    }

    /**
     * Get greeting based on time of day
     * @returns {string}
     */
    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 11) return 'Selamat Pagi';
        if (hour < 15) return 'Selamat Siang';
        if (hour < 18) return 'Selamat Sore';
        return 'Selamat Malam';
    }

    /**
     * Format date to Indonesian locale
     * @param {string|Date} date
     * @returns {string}
     */
    function formatDate(date) {
        const d = new Date(date);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    /**
     * Format time from Date
     * @param {string|Date} date
     * @returns {string}
     */
    function formatTime(date) {
        const d = new Date(date);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    /**
     * Format date for record display (e.g., "Sen, 3 Mar")
     */
    function formatRecordDate(date) {
        const d = new Date(date);
        const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
    }

    /**
     * Set active navigation item
     * @param {string} page - Current page name
     */
    function setActiveNav(page) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
    }

    /**
     * Show loading overlay
     * @param {string} text - Loading text
     */
    function showLoading(text = 'Memproses...') {
        let overlay = document.querySelector('.loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">${text}</div>
      `;
            document.body.appendChild(overlay);
        }
    }

    /**
     * Hide loading overlay
     */
    function hideLoading() {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.remove();
    }

    /**
     * Simulate API call with delay
     * @param {Function} fn - Function to execute
     * @param {number} delay - Delay in ms
     */
    function simulateAPI(fn, delay = 1000) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(fn());
            }, delay);
        });
    }

    // ── PWA Install Prompt ──
    let deferredInstallPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        showInstallBanner();
    });

    function showInstallBanner() {
        // Only show on dashboard (index.html)
        if (!window.location.pathname.includes('index.html') &&
            !window.location.pathname.endsWith('/pegawai/')) return;
        if (document.querySelector('.pwa-install-banner')) return;

        const banner = document.createElement('div');
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;flex:1">
                <span style="font-size:1.5rem">📱</span>
                <div>
                    <div style="font-weight:600;font-size:0.85rem">Install Aplikasi</div>
                    <div style="font-size:0.75rem;color:#94A3B8">Akses lebih cepat dari home screen</div>
                </div>
            </div>
            <button class="pwa-install-btn" style="padding:8px 16px;background:linear-gradient(135deg,#0D9488,#0F766E);color:white;border:none;border-radius:8px;font-weight:600;font-size:0.8rem;cursor:pointer">Install</button>
            <button class="pwa-dismiss-btn" style="padding:4px 8px;background:none;border:none;color:#64748B;cursor:pointer;font-size:1.1rem">✕</button>
        `;
        document.body.appendChild(banner);

        banner.querySelector('.pwa-install-btn')?.addEventListener('click', installPWA);
        banner.querySelector('.pwa-dismiss-btn')?.addEventListener('click', () => banner.remove());
    }

    async function installPWA() {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        if (result.outcome === 'accepted') {
            showToast('Aplikasi berhasil diinstall! 🎉', 'success');
        }
        deferredInstallPrompt = null;
        const banner = document.querySelector('.pwa-install-banner');
        if (banner) banner.remove();
    }

    // ── Offline / Online Detection ──
    function showOfflineBanner() {
        if (document.querySelector('.offline-banner')) return;
        const banner = document.createElement('div');
        banner.className = 'offline-banner';
        banner.innerHTML = '⚠ Anda sedang offline. Absensi memerlukan koneksi internet.';
        document.body.prepend(banner);
    }

    function hideOfflineBanner() {
        const banner = document.querySelector('.offline-banner');
        if (banner) banner.remove();
    }

    window.addEventListener('offline', () => {
        showOfflineBanner();
        showToast('Koneksi internet terputus', 'error');
    });

    window.addEventListener('online', () => {
        hideOfflineBanner();
        showToast('Koneksi internet kembali', 'success');
    });

    if (!navigator.onLine) showOfflineBanner();

    // ── Service Worker Registration ──
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/pegawai/sw.js', { scope: '/pegawai/' })
                .then(reg => {
                    console.log('[SW] Registered:', reg.scope);
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                                showToast('Versi baru tersedia! Silakan refresh.', 'info', 5000);
                            }
                        });
                    });
                })
                .catch(err => console.warn('[SW] Registration failed:', err));
        });
    }

    return {
        initClock,
        showToast,
        getGreeting,
        formatDate,
        formatTime,
        formatRecordDate,
        setActiveNav,
        showLoading,
        hideLoading,
        simulateAPI,
        installPWA
    };
})();
