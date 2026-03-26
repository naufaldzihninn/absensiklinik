/* =====================================================
   API Client — Admin Dashboard
   Centralized fetch wrapper for admin API calls
   ===================================================== */

const AdminAPI = (() => {
    const BASE_URL = '/api';
    const TOKEN_KEY = 'admin_token';
    const SESSION_KEY = 'admin_session';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    function setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_KEY);
    }

    async function request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;
        const token = getToken();

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...(options.headers || {})
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    clearToken();
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            return data;
        } catch (err) {
            if (err.message === 'Failed to fetch') {
                throw new Error('Server tidak dapat dihubungi.');
            }
            throw err;
        }
    }

    // ── Auth ──
    async function login(username, password) {
        const data = await request('/auth/login', {
            method: 'POST',
            body: { username, password }
        });
        if (data.user.role !== 'admin') {
            throw new Error('Akun ini bukan admin.');
        }
        setToken(data.token);
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        return data;
    }

    function logout() {
        clearToken();
        window.location.href = 'login.html';
    }

    function getSession() {
        const d = localStorage.getItem(SESSION_KEY);
        if (!d) return null;
        try { return JSON.parse(d); } catch { return null; }
    }

    function isAuthenticated() {
        return getToken() !== null && getSession() !== null;
    }

    // ── Pegawai ──
    function getPegawai() { return request('/pegawai'); }
    function createPegawai(body) {
        return request('/pegawai', { method: 'POST', body });
    }
    function updatePegawai(id, body) {
        return request(`/pegawai/${id}`, { method: 'PUT', body });
    }
    function deletePegawai(id) {
        return request(`/pegawai/${id}`, { method: 'DELETE' });
    }

    // ── Absensi ──
    function getTodayStats() { return request('/absensi/today'); }
    function getHistory(params = '') { return request(`/absensi/history?${params}`); }
    function getWeeklyTrend() { return request('/absensi/weekly-trend'); }

    // ── Face ──
    function resetFace(id) {
        return request(`/face/reset/${id}`, { method: 'DELETE' });
    }

    // ── Settings ──
    function getSettings() { return request('/settings'); }
    function updateSettings(body) {
        return request('/settings', { method: 'PUT', body });
    }
    function getShifts() { return request('/shift'); }
    function updateShift(id, body) {
        return request(`/shift/${id}`, { method: 'PUT', body });
    }
    function getAuditLog(params = '') { return request(`/audit-log?${params}`); }
    function getHolidays(year) { return request(`/holidays${year ? '?year=' + year : ''}`); }
    function checkHoliday(date) { return request(`/holidays/check${date ? '?date=' + date : ''}`); }

    return {
        login, logout, getSession, isAuthenticated,
        getPegawai, createPegawai, updatePegawai, deletePegawai,
        getTodayStats, getHistory, getWeeklyTrend, resetFace,
        getSettings, updateSettings, getShifts, updateShift, getAuditLog,
        getHolidays, checkHoliday,
        request, BASE_URL
    };
})();
