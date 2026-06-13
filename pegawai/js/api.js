/* =====================================================
   API Client — PWA Pegawai
   Centralized fetch wrapper for all backend API calls
   ===================================================== */

const API = (() => {
    const BASE_URL = '/api';
    const TOKEN_KEY = 'absensi_token';

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    }

    function setToken(token, remember = true) {
        if (remember) {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            sessionStorage.setItem(TOKEN_KEY, token);
        }
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
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

        if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                // Auto-logout on expired token
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
                throw new Error('Server tidak dapat dihubungi. Pastikan backend sedang berjalan.');
            }
            throw err;
        }
    }

    // ── Auth ──
    async function login(username, password, rememberMe = true) {
        const data = await request('/auth/login', {
            method: 'POST',
            body: { username, password }
        });
        setToken(data.token, rememberMe);
        // Store user info
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('absensi_session', JSON.stringify(data.user));
        return data;
    }

    function logout() {
        clearToken();
        localStorage.removeItem('absensi_session');
        sessionStorage.removeItem('absensi_session');
        localStorage.removeItem('absensi_remember_me');
        window.location.href = 'login.html';
    }

    function getSession() {
        const data = localStorage.getItem('absensi_session') || sessionStorage.getItem('absensi_session');
        if (!data) return null;
        try { return JSON.parse(data); } catch { return null; }
    }

    function isAuthenticated() {
        return getToken() !== null && getSession() !== null;
    }

    function updateSession(newSessionData) {
        const currentData = localStorage.getItem('absensi_session');
        const storage = currentData ? localStorage : sessionStorage;
        storage.setItem('absensi_session', JSON.stringify(newSessionData));
    }

    // ── Pegawai ──
    function getProfile() {
        return request('/pegawai/me');
    }

    // ── Absensi ──
    function clockIn(latitude, longitude, descriptor) {
        return request('/absensi/clock-in', {
            method: 'POST',
            body: { latitude, longitude, descriptor }
        });
    }

    function clockOut(latitude, longitude, descriptor) {
        return request('/absensi/clock-out', {
            method: 'POST',
            body: { latitude, longitude, descriptor }
        });
    }

    function getHistory(days = 30) {
        return request(`/absensi/history?days=${days}`);
    }

    // ── Face ──
    function getFaceConfig() {
        return request('/face/config');
    }

    function registerFace(samples) {
        return request('/face/register', {
            method: 'POST',
            body: { samples }
        });
    }

    function matchFace(descriptor) {
        return request('/face/match', {
            method: 'POST',
            body: { descriptor }
        });
    }

    // ── Settings ──
    function getSettings() {
        return request('/settings');
    }

    function getShifts() {
        return request('/shift');
    }

    function getServerTime() {
        return request('/server-time');
    }

    // ── Holidays ──
    function getHolidays(year) {
        return request(`/holidays${year ? '?year=' + year : ''}`);
    }

    function checkHoliday(date) {
        return request(`/holidays/check${date ? '?date=' + date : ''}`);
    }

    return {
        login, logout, getSession, updateSession, isAuthenticated, getToken,
        getProfile, clockIn, clockOut, getHistory,
        getFaceConfig, registerFace, matchFace,
        getSettings, getShifts, getServerTime,
        getHolidays, checkHoliday,
        request, clearToken, BASE_URL
    };
})();
