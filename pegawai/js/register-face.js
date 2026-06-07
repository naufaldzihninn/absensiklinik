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

    let capturedPhoto = null;
    let extractedDescriptor = null;

    function setDisplay(id, display) {
        const element = document.getElementById(id);
        if (element) element.style.display = display;
    }

    function setButtonState(button, text, disabled) {
        if (!button) return;
        button.textContent = text;
        button.disabled = disabled;
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
        setButtonState(btn, '⏳ Memuat AI Model...', true);

        try {
            await waitForFaceApi();
            await FaceAI.load((message) => {
                setButtonState(btn, `⏳ ${message}`, true);
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
            setDisplay('cameraView', 'flex');
        } catch (err) {
            App.showToast(err.message, 'error');
        }
    }

    function closeCamera() {
        Camera.stop();
        setDisplay('cameraView', 'none');
        setDisplay('stepInstruction', 'flex');
    }

    async function capturePhoto() {
        try {
            const confirmBtn = document.getElementById('confirmBtn');
            setButtonState(confirmBtn, '🔍 Mendeteksi wajah...', true);

            const video = document.getElementById('cameraFeed');
            const result = await FaceAI.detectFromVideo(video);

            capturedPhoto = Camera.capture();
            Camera.stop();

            const facePreview = document.getElementById('facePreview');
            if (facePreview) facePreview.src = capturedPhoto;

            setDisplay('cameraView', 'none');
            setDisplay('stepConfirm', 'flex');

            if (result) {
                extractedDescriptor = result.descriptor;
                setButtonState(confirmBtn, `✓ Wajah Terdeteksi (${(result.score * 100).toFixed(0)}%)`, false);
                confirmBtn.style.background = '';
            } else {
                extractedDescriptor = null;
                setButtonState(confirmBtn, '❌ Wajah Tidak Terdeteksi', true);
                App.showToast('Wajah tidak terdeteksi. Silakan foto ulang dengan pencahayaan lebih baik.', 'error');
            }
        } catch (err) {
            App.showToast(err.message, 'error');
        }
    }

    function retakePhoto() {
        capturedPhoto = null;
        extractedDescriptor = null;
        setDisplay('stepConfirm', 'none');
        setDisplay('stepInstruction', 'flex');
    }

    async function confirmPhoto() {
        if (!extractedDescriptor) {
            App.showToast('Wajah belum terdeteksi. Silakan foto ulang.', 'error');
            return;
        }

        const confirmBtn = document.getElementById('confirmBtn');
        setButtonState(confirmBtn, '⏳ Mendaftarkan...', true);

        try {
            await API.registerFace(extractedDescriptor);
            API.updateSession({ ...API.getSession(), has_vektor: true, status_wajah: true });

            setDisplay('stepConfirm', 'none');
            setDisplay('stepSuccess', 'flex');
        } catch (err) {
            App.showToast(err.message, 'error');
            setButtonState(confirmBtn, 'Konfirmasi', false);
        }
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

    preloadModels();
})();
