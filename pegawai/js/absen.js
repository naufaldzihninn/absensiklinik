(() => {
    if (!API.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const absenType = params.get('type') === 'pulang' ? 'pulang' : 'masuk';
    const isMasuk = absenType === 'masuk';
    let isProcessing = false;

    function setDisplay(id, display) {
        const element = document.getElementById(id);
        if (element) element.style.display = display;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function setCaptureDisabled(disabled) {
        const captureBtn = document.getElementById('captureBtn');
        if (captureBtn) captureBtn.disabled = disabled;
    }

    function waitForFaceApi() {
        return new Promise((resolve, reject) => {
            if (typeof faceapi !== 'undefined') return resolve();

            const check = setInterval(() => {
                if (typeof faceapi !== 'undefined') {
                    clearInterval(check);
                    resolve();
                }
            }, 200);

            setTimeout(() => {
                clearInterval(check);
                reject(new Error('face-api timeout'));
            }, 15000);
        });
    }

    async function initCamera() {
        try {
            isProcessing = false;
            setCaptureDisabled(false);

            const video = document.getElementById('cameraFeed');
            await Camera.start(video);

            waitForFaceApi()
                .then(() => FaceAI.load((message) => console.log('[FaceAI]', message)))
                .catch((err) => console.warn('Model load:', err.message));
        } catch (err) {
            App.showToast(err.message, 'error');
            setTimeout(goToDashboard, 2000);
        }
    }

    async function captureAndVerify() {
        if (isProcessing) return;
        isProcessing = true;
        setCaptureDisabled(true);

        try {
            if (!FaceAI.isReady()) {
                App.showToast('Memuat model AI, tunggu sebentar...', 'info');
                await waitForFaceApi();
                await FaceAI.load();
            }

            const video = document.getElementById('cameraFeed');
            setText('processingText', 'Mendeteksi wajah...');
            const faceResult = await FaceAI.detectFromVideo(video);

            Camera.stop();
            setDisplay('cameraScreen', 'none');
            setDisplay('processingScreen', 'flex');

            if (!faceResult) {
                showFailResult('Wajah tidak terdeteksi. Pastikan wajah terlihat jelas dan pencahayaan cukup.');
                return;
            }

            setText('processingText', 'Mengambil lokasi GPS...');
            let gps;
            try {
                const pos = await Geolocation.getCurrentPosition();
                gps = { latitude: pos.latitude, longitude: pos.longitude };
            } catch (err) {
                throw new Error(err.message || 'GPS wajib aktif untuk absensi.');
            }

            setText('processingText', 'Menyimpan data absensi...');
            const result = isMasuk
                ? await API.clockIn(gps.latitude, gps.longitude, faceResult.descriptor)
                : await API.clockOut(gps.latitude, gps.longitude, faceResult.descriptor);

            const akurasi = result.face?.score || result.data?.akurasi_wajah || 0;
            showSuccessResult(result, akurasi);
        } catch (err) {
            Camera.stop();
            showFailResult(err.message);
        }
    }

    function showSuccessResult(result, akurasi) {
        const record = result.data || {};

        setText('successTitle', isMasuk ? 'Clock In Berhasil! ✅' : 'Clock Out Berhasil! ✅');
        setText(
            'successDetail',
            isMasuk ? 'Selamat bekerja, semoga harimu menyenangkan!' : 'Terima kasih, selamat beristirahat!'
        );
        setText('resultShift', result.shift ? `Shift ${result.shift}` : '-');
        setText('resultTime', record.waktu_absen ? App.formatTime(record.waktu_absen) : '-');

        const statusEl = document.getElementById('resultStatus');
        if (statusEl) {
            if (isMasuk) {
                const status = record.status_kehadiran || result.status;
                statusEl.innerHTML = status === 'Terlambat'
                    ? '<span class="badge badge-warning">Terlambat</span>'
                    : '<span class="badge badge-success">Tepat Waktu</span>';
            } else {
                statusEl.innerHTML = '<span class="badge badge-success">Selesai</span>';
            }
        }

        setText('resultAkurasi', `${((akurasi || record.akurasi_wajah || 0) * 100).toFixed(1)}%`);
        setDisplay('processingScreen', 'none');
        setDisplay('successScreen', 'flex');
    }

    function showFailResult(message) {
        setText('failDetail', message || 'Wajah tidak cocok dengan data terdaftar. Silakan coba lagi.');
        setDisplay('cameraScreen', 'none');
        setDisplay('processingScreen', 'none');
        setDisplay('successScreen', 'none');
        setDisplay('failScreen', 'flex');
        isProcessing = false;
    }

    function retryCapture() {
        setDisplay('failScreen', 'none');
        setDisplay('successScreen', 'none');
        setDisplay('processingScreen', 'none');
        setDisplay('cameraScreen', 'flex');
        initCamera();
    }

    function goToDashboard() {
        Camera.stop();
        window.location.href = 'index.html';
    }

    setText('absenTypeLabel', isMasuk ? 'Clock In' : 'Clock Out');
    document.getElementById('backBtn')?.addEventListener('click', goToDashboard);
    document.getElementById('captureBtn')?.addEventListener('click', captureAndVerify);
    document.getElementById('successDashboardBtn')?.addEventListener('click', goToDashboard);
    document.getElementById('failDashboardBtn')?.addEventListener('click', goToDashboard);
    document.getElementById('retryCaptureBtn')?.addEventListener('click', retryCapture);
    window.addEventListener('beforeunload', () => Camera.stop());

    initCamera();
})();
