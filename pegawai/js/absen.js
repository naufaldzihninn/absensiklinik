(() => {
    if (!API.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const absenType = params.get('type') === 'pulang' ? 'pulang' : 'masuk';
    const isMasuk = absenType === 'masuk';
    let isProcessing = false;
    let faceConfig = { provider: 'faceapi', requireClientDescriptor: true };

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

    function qualityMessage(reason) {
        const messages = {
            REJECTED_NO_FACE: 'Wajah tidak terdeteksi. Pastikan wajah terlihat jelas.',
            REJECTED_MULTIPLE_FACES: 'Terdeteksi lebih dari satu wajah. Pastikan hanya Anda di kamera.',
            REJECTED_LOW_QUALITY: 'Foto kurang jelas. Coba dengan pencahayaan lebih baik.',
            REJECTED_POSE: 'Wajah terlalu miring. Hadapkan wajah ke kamera.'
        };
        return messages[reason] || 'Wajah belum siap. Silakan coba lagi.';
    }

    async function initCamera() {
        try {
            isProcessing = false;
            setCaptureDisabled(false);

            const video = document.getElementById('cameraFeed');
            await Camera.start(video);

            API.getFaceConfig()
                .then((config) => {
                    faceConfig = config;
                    if (!faceConfig.requireClientDescriptor) return null;
                    return waitForFaceApi().then(() => FaceAI.load((message) => console.log('[FaceAI]', message)));
                })
                .catch((err) => console.warn('Face config/model load:', err.message));
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
            try {
                faceConfig = await API.getFaceConfig();
            } catch (err) {
                console.warn('Face config:', err.message);
            }

            if (faceConfig.requireClientDescriptor && !FaceAI.isReady()) {
                App.showToast('Memuat model AI, tunggu sebentar...', 'info');
                await waitForFaceApi();
                await FaceAI.load();
            }

            const video = document.getElementById('cameraFeed');
            setDisplay('processingScreen', 'flex');

            setText('processingText', 'Memverifikasi wajah...');
            const faceResult = faceConfig.requireClientDescriptor
                ? await FaceAI.analyze(video)
                : { descriptor: null, quality: null };
            const capturedPhoto = faceConfig.requireClientDescriptor && !faceResult.descriptor
                ? null
                : Camera.capture();
            Camera.stop();
            setDisplay('cameraScreen', 'none');

            if (faceConfig.requireClientDescriptor && !faceResult.descriptor) {
                showFailResult(qualityMessage(faceResult.quality?.reason));
                return;
            }

            const faceSample = {
                descriptor: faceResult.descriptor,
                quality: faceResult.quality,
                image: capturedPhoto
            };

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
                ? await API.clockIn(gps.latitude, gps.longitude, faceSample)
                : await API.clockOut(gps.latitude, gps.longitude, faceSample);

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

        setText('resultAkurasi', (akurasi || record.akurasi_wajah) ? 'Terverifikasi' : '-');
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
