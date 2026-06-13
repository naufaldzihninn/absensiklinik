(() => {
    if (!API.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const session = API.getSession();
    if (session && session.has_vektor) {
        window.location.href = 'index.html';
        return;
    }

    const REQUIRED_SAMPLES = 5;
    const sampleGuides = [
        'Hadap lurus ke kamera',
        'Miringkan wajah sedikit ke kiri',
        'Miringkan wajah sedikit ke kanan',
        'Pastikan pencahayaan normal',
        'Wajah natural tanpa ekspresi berlebihan'
    ];

    let capturedPhoto = null;
    let capturedSample = null;
    const samples = [];
    const previews = [];

    function setDisplay(id, display) {
        const element = document.getElementById(id);
        if (element) element.style.display = display;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function setButtonState(button, text, disabled) {
        if (!button) return;
        button.textContent = text;
        button.disabled = disabled;
    }

    function currentSampleNumber() {
        return Math.min(samples.length + 1, REQUIRED_SAMPLES);
    }

    function updateProgress() {
        const current = currentSampleNumber();
        setText('sampleCounter', `${samples.length}/${REQUIRED_SAMPLES} foto valid`);
        setText('sampleGuide', sampleGuides[current - 1] || sampleGuides[0]);
        setText('cameraSampleLabel', `Foto ${current}/${REQUIRED_SAMPLES}`);

        const list = document.getElementById('samplePreviewList');
        if (list) {
            list.innerHTML = previews.map((src, index) => `
                <div class="face-sample-thumb">
                    <img src="${src}" alt="Foto wajah ${index + 1}">
                    <span>${index + 1}</span>
                </div>
            `).join('');
        }
    }

    async function waitForFaceApi() {
        await new Promise((resolve) => {
            const check = setInterval(() => {
                if (typeof faceapi !== 'undefined') {
                    clearInterval(check);
                    resolve();
                }
            }, 200);

            setTimeout(() => {
                clearInterval(check);
                resolve();
            }, 15000);
        });
    }

    async function preloadModels() {
        const btn = document.getElementById('startCameraBtn');
        setButtonState(btn, 'Memuat AI Model...', true);

        try {
            await waitForFaceApi();
            await FaceAI.load((message) => {
                setButtonState(btn, message, true);
            });
            setButtonState(btn, 'Buka Kamera', false);
        } catch (err) {
            setButtonState(btn, 'Buka Kamera', false);
            console.warn('Model pre-load failed, will retry:', err.message);
        }
    }

    async function openCamera() {
        try {
            if (!FaceAI.isReady()) {
                App.showToast('Memuat model AI, tunggu sebentar...', 'info');
                await FaceAI.load();
            }

            const video = document.getElementById('cameraFeed');
            await Camera.start(video);
            setDisplay('stepInstruction', 'none');
            setDisplay('stepConfirm', 'none');
            setDisplay('cameraView', 'flex');
            updateProgress();
        } catch (err) {
            App.showToast(err.message, 'error');
        }
    }

    function closeCamera() {
        Camera.stop();
        setDisplay('cameraView', 'none');
        setDisplay('stepInstruction', 'flex');
    }

    function qualityMessage(reason) {
        const messages = {
            REJECTED_NO_FACE: 'Wajah tidak terdeteksi. Posisikan wajah di tengah frame.',
            REJECTED_MULTIPLE_FACES: 'Terdeteksi lebih dari satu wajah. Pastikan hanya Anda di kamera.',
            REJECTED_LOW_QUALITY: 'Foto kurang jelas. Coba dengan cahaya lebih terang dan wajah lebih dekat.',
            REJECTED_POSE: 'Wajah terlalu miring. Hadapkan wajah sedikit lebih lurus.'
        };
        return messages[reason] || 'Foto belum valid. Silakan coba lagi.';
    }

    async function capturePhoto() {
        try {
            const captureBtn = document.getElementById('captureBtn');
            captureBtn.disabled = true;

            const video = document.getElementById('cameraFeed');
            const result = await FaceAI.analyze(video);

            if (!result.descriptor) {
                App.showToast(qualityMessage(result.quality?.reason), 'error');
                captureBtn.disabled = false;
                return;
            }

            capturedSample = {
                descriptor: result.descriptor,
                quality: result.quality
            };
            capturedPhoto = Camera.capture();
            Camera.stop();

            const facePreview = document.getElementById('facePreview');
            if (facePreview) facePreview.src = capturedPhoto;

            setText('confirmTitle', `Konfirmasi Foto ${currentSampleNumber()}`);
            setText('confirmHelp', sampleGuides[currentSampleNumber() - 1]);
            setButtonState(document.getElementById('confirmBtn'), 'Simpan Foto', false);
            setDisplay('cameraView', 'none');
            setDisplay('stepConfirm', 'flex');
            captureBtn.disabled = false;
        } catch (err) {
            App.showToast(err.message, 'error');
            const captureBtn = document.getElementById('captureBtn');
            if (captureBtn) captureBtn.disabled = false;
        }
    }

    function retakePhoto() {
        capturedPhoto = null;
        capturedSample = null;
        openCamera();
    }

    async function submitRegistration() {
        const confirmBtn = document.getElementById('confirmBtn');
        setButtonState(confirmBtn, 'Mendaftarkan...', true);

        try {
            await API.registerFace(samples);
            API.updateSession({ ...API.getSession(), has_vektor: true, status_wajah: true });

            setDisplay('stepConfirm', 'none');
            setDisplay('stepInstruction', 'none');
            setDisplay('stepSuccess', 'flex');
        } catch (err) {
            App.showToast(err.message, 'error');
            setButtonState(confirmBtn, 'Coba Lagi', false);
        }
    }

    async function confirmPhoto() {
        if (!capturedSample && samples.length >= REQUIRED_SAMPLES) {
            await submitRegistration();
            return;
        }

        if (!capturedSample) {
            App.showToast('Wajah belum terdeteksi. Silakan foto ulang.', 'error');
            return;
        }

        samples.push(capturedSample);
        previews.push(capturedPhoto);
        capturedPhoto = null;
        capturedSample = null;
        updateProgress();

        if (samples.length >= REQUIRED_SAMPLES) {
            await submitRegistration();
            return;
        }

        setDisplay('stepConfirm', 'none');
        setDisplay('stepInstruction', 'flex');
        App.showToast(`Foto ${samples.length} tersimpan. Lanjutkan foto berikutnya.`, 'success');
    }

    function goToDashboard() {
        window.location.href = 'index.html';
    }

    document.getElementById('startCameraBtn')?.addEventListener('click', openCamera);
    document.getElementById('closeCameraBtn')?.addEventListener('click', closeCamera);
    document.getElementById('captureBtn')?.addEventListener('click', capturePhoto);
    document.getElementById('retakePhotoBtn')?.addEventListener('click', retakePhoto);
    document.getElementById('confirmBtn')?.addEventListener('click', confirmPhoto);
    document.getElementById('dashboardBtn')?.addEventListener('click', goToDashboard);
    window.addEventListener('beforeunload', () => Camera.stop());

    updateProgress();
    preloadModels();
})();
