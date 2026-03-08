/* =====================================================
   Admin Auth — Authentication Helpers
   ===================================================== */

const AdminAuth = (() => {
    const SESSION_KEY = 'admin_session';

    const MOCK_ADMINS = [
        { username: 'admin', password: 'admin123', nama: 'Administrator' }
    ];

    function login(username, password) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const admin = MOCK_ADMINS.find(
                    a => a.username === username && a.password === password
                );
                if (admin) {
                    const session = {
                        username: admin.username,
                        nama_lengkap: admin.nama,
                        role: 'admin',
                        token: 'admin-jwt-' + Date.now(),
                        login_at: new Date().toISOString()
                    };
                    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                    resolve(session);
                } else {
                    reject(new Error('Username atau password admin salah'));
                }
            }, 600);
        });
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = 'login.html';
    }

    function getSession() {
        const data = localStorage.getItem(SESSION_KEY);
        if (!data) return null;
        try { return JSON.parse(data); } catch { return null; }
    }

    function isAuthenticated() {
        return getSession() !== null;
    }

    function requireAuth() {
        if (!isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    return { login, logout, getSession, isAuthenticated, requireAuth };
})();
