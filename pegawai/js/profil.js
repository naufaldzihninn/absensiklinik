(() => {
    if (!API.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function setFaceStatus(session) {
        const faceStatusEl = document.getElementById('infoFaceStatus');
        if (!faceStatusEl) return;

        if (session.has_vektor || session.status_wajah) {
            faceStatusEl.innerHTML = '<span class="badge badge-success">Terdaftar ✓</span>';
        } else {
            faceStatusEl.innerHTML = '<span class="badge badge-warning">Belum Terdaftar</span>';
        }
    }

    function updateProfileUI(session) {
        if (!session) return;

        const roleLabel = session.role === 'admin' ? 'Administrator' : 'Pegawai';
        setText('profileName', session.nama_lengkap || '...');
        setText('profileRole', roleLabel);
        setText('infoUsername', session.username || '-');
        setText('infoNama', session.nama_lengkap || '-');
        setText('infoRole', roleLabel);
        setFaceStatus(session);
    }

    async function initProfile() {
        const cachedSession = API.getSession();
        updateProfileUI(cachedSession);

        try {
            const result = await API.getProfile();
            const user = result.data;

            if (user) {
                const freshSession = { ...cachedSession, ...user, has_vektor: user.status_wajah };
                API.updateSession(freshSession);
                updateProfileUI(freshSession);
            }

            const statsResult = await API.getHistory(30);
            const records = statsResult.data || [];
            const now = new Date();
            const monthRecords = records.filter((record) => {
                const date = new Date(record.waktu_absen);
                return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
            });
            const clockIns = monthRecords.filter((record) => record.tipe_absen === 'MASUK');

            setText('statHadir', clockIns.length);
            setText('statTelat', clockIns.filter((record) => record.status_kehadiran === 'Terlambat').length);
            setText('statAlpa', 0);
        } catch (err) {
            console.error('Profile init error:', err);
        }
    }

    function resetFace() {
        const session = API.getSession();

        if (session && (session.has_vektor || session.status_wajah)) {
            App.showToast('Silakan hubungi Admin klinik untuk mereset data wajah lama Anda terlebih dahulu.', 'warning');
            return;
        }

        if (confirm('Data wajah Anda saat ini kosong. Lanjut mendaftarkan wajah baru?')) {
            window.location.href = 'register-face.html';
        }
    }

    function openLogoutModal() {
        const modal = document.getElementById('logoutModal');
        if (modal) modal.style.display = 'flex';
    }

    function closeLogoutModal() {
        const modal = document.getElementById('logoutModal');
        if (modal) modal.style.display = 'none';
    }

    function bindActivation(id, handler) {
        const element = document.getElementById(id);
        if (!element) return;

        element.addEventListener('click', handler);
        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handler();
            }
        });
    }

    App.setActiveNav('profil');
    bindActivation('resetFaceBtn', resetFace);
    bindActivation('logoutBtn', openLogoutModal);
    document.getElementById('closeLogoutModalBtn')?.addEventListener('click', closeLogoutModal);
    document.getElementById('confirmLogoutBtn')?.addEventListener('click', () => API.logout());
    initProfile();
})();
