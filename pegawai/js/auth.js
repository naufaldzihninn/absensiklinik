/* =====================================================
   Auth Module — Mock Authentication
   ===================================================== */

const Auth = (() => {
    const SESSION_KEY = 'absensi_session';
    const FACE_REGISTERED_KEY = 'absensi_face_registered';
    const REMEMBER_KEY = 'absensi_remember_me';

    // Helper: get the active storage (localStorage if remember me, else sessionStorage)
    function _getStorage() {
        return localStorage.getItem(REMEMBER_KEY) === 'true' ? localStorage : sessionStorage;
    }

    // Helper: get session from either storage
    function _findSession() {
        const fromLocal = localStorage.getItem(SESSION_KEY);
        if (fromLocal) return fromLocal;
        return sessionStorage.getItem(SESSION_KEY);
    }

    // Mock credentials
    const MOCK_CREDENTIALS = [
        { username: 'budi.santoso', password: 'password123', nama: 'Budi Santoso' },
        { username: 'siti.rahma', password: 'password123', nama: 'Siti Rahma' },
        { username: 'admin', password: 'admin123', nama: 'Administrator', role: 'admin' }
    ];

    function login(username, password, rememberMe = false) {
        return new Promise((resolve, reject) => {
            // Simulate API delay
            setTimeout(() => {
                const user = MOCK_CREDENTIALS.find(
                    u => u.username === username && u.password === password
                );

                if (user) {
                    const session = {
                        id_pegawai: `emp-${username}-uuid`,
                        username: user.username,
                        nama_lengkap: user.nama,
                        role: user.role || 'pegawai',
                        token: 'mock-jwt-token-' + Date.now(),
                        login_at: new Date().toISOString()
                    };

                    // Store remember me preference
                    if (rememberMe) {
                        localStorage.setItem(REMEMBER_KEY, 'true');
                        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                    } else {
                        localStorage.removeItem(REMEMBER_KEY);
                        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
                    }

                    resolve(session);
                } else {
                    reject(new Error('Username atau password salah'));
                }
            }, 800);
        });
    }

    function logout() {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(FACE_REGISTERED_KEY);
        localStorage.removeItem(REMEMBER_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(FACE_REGISTERED_KEY);
        window.location.href = 'login.html';
    }

    function getSession() {
        const data = _findSession();
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    function isAuthenticated() {
        return getSession() !== null;
    }

    function isFaceRegistered() {
        return localStorage.getItem(FACE_REGISTERED_KEY) === 'true' ||
            sessionStorage.getItem(FACE_REGISTERED_KEY) === 'true';
    }

    function setFaceRegistered(val = true) {
        // Always save to localStorage so it persists for face status
        localStorage.setItem(FACE_REGISTERED_KEY, val.toString());
    }

    // Auth guard — redirect to login if not authenticated
    function requireAuth() {
        if (!isAuthenticated()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // Check if face registration is needed
    function checkFaceRegistration() {
        if (isAuthenticated() && !isFaceRegistered()) {
            window.location.href = 'register-face.html';
            return false;
        }
        return true;
    }

    return {
        login,
        logout,
        getSession,
        isAuthenticated,
        isFaceRegistered,
        setFaceRegistered,
        requireAuth,
        checkFaceRegistration
    };
})();
