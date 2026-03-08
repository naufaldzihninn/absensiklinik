/* =====================================================
   Camera Module — Live Capture Helpers
   ===================================================== */

const Camera = (() => {
    let stream = null;
    let videoElement = null;

    /**
     * Initialize front-facing camera
     * @param {HTMLVideoElement} video - The video element to attach the stream
     * @returns {Promise<MediaStream>}
     */
    async function start(video) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });
            video.srcObject = stream;
            videoElement = video;
            await video.play();
            return stream;
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw new Error('Akses kamera ditolak. Silakan aktifkan izin kamera di pengaturan browser Anda.');
            } else if (err.name === 'NotFoundError') {
                throw new Error('Kamera tidak ditemukan pada perangkat ini.');
            } else {
                throw new Error('Gagal mengakses kamera: ' + err.message);
            }
        }
    }

    /**
     * Capture a frame from the video stream
     * @returns {string} Base64 data URL of the captured frame
     */
    function capture() {
        if (!videoElement) {
            throw new Error('Kamera belum diinisialisasi');
        }

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        const ctx = canvas.getContext('2d');
        // Mirror the image (since we use front camera)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.85);
    }

    /**
     * Stop the camera stream
     */
    function stop() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (videoElement) {
            videoElement.srcObject = null;
            videoElement = null;
        }
    }

    /**
     * Check if camera is available
     * @returns {Promise<boolean>}
     */
    async function isAvailable() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(d => d.kind === 'videoinput');
        } catch {
            return false;
        }
    }

    return { start, capture, stop, isAvailable };
})();
