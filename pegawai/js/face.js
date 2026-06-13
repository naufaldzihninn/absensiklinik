/* =====================================================
   FaceAI Module — face-api.js wrapper
   Client-side face detection, descriptor extraction,
   and matching for the attendance PWA.
   ===================================================== */

const FaceAI = (() => {
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    let modelsLoaded = false;
    let loadingPromise = null;

    /**
     * Load face-api.js neural network models.
     * Uses TinyFaceDetector (fast, lightweight) + FaceLandmark68 + FaceRecognition.
     * Models are ~5MB, cached by the browser after first load.
     */
    async function load(onProgress) {
        if (modelsLoaded) return;
        if (loadingPromise) return loadingPromise;

        loadingPromise = (async () => {
            try {
                if (typeof faceapi === 'undefined') {
                    throw new Error('face-api.js library belum dimuat.');
                }

                if (onProgress) onProgress('Memuat model deteksi wajah...');
                await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);

                if (onProgress) onProgress('Memuat model landmark wajah...');
                await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);

                if (onProgress) onProgress('Memuat model pengenalan wajah...');
                await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

                modelsLoaded = true;
                if (onProgress) onProgress('Model siap ✓');
                console.log('[FaceAI] Models loaded successfully');
            } catch (err) {
                loadingPromise = null;
                throw new Error('Gagal memuat model AI: ' + err.message);
            }
        })();

        return loadingPromise;
    }

    /**
     * Check if models are loaded
     */
    function isReady() {
        return modelsLoaded;
    }

    function getInputSize(input) {
        return {
            width: input.videoWidth || input.naturalWidth || input.width || 0,
            height: input.videoHeight || input.naturalHeight || input.height || 0
        };
    }

    function center(points) {
        if (!points || points.length === 0) return null;
        const total = points.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });
        return {
            x: total.x / points.length,
            y: total.y / points.length
        };
    }

    function calculatePoseScore(landmarks) {
        if (!landmarks) return null;
        const leftEye = center(landmarks.getLeftEye());
        const rightEye = center(landmarks.getRightEye());
        const nose = center(landmarks.getNose());
        const mouth = center(landmarks.getMouth());

        if (!leftEye || !rightEye || !nose || !mouth) return null;

        const eyeDistance = Math.max(1, Math.abs(rightEye.x - leftEye.x));
        return Math.abs(rightEye.y - leftEye.y) / eyeDistance;
    }

    function buildQuality(result, faceCount, input) {
        const inputSize = getInputSize(input);
        const box = result?.detection?.box || {};
        const detectionScore = Number(result?.detection?.score || 0);
        const poseScore = calculatePoseScore(result?.landmarks);

        let reason = null;
        if (faceCount < 1) reason = 'REJECTED_NO_FACE';
        if (faceCount > 1) reason = 'REJECTED_MULTIPLE_FACES';
        if (!reason && detectionScore < 0.75) reason = 'REJECTED_LOW_QUALITY';
        if (!reason && ((box.width || 0) < 120 || (box.height || 0) < 120)) reason = 'REJECTED_LOW_QUALITY';
        if (!reason && Number.isFinite(poseScore) && poseScore > 0.22) reason = 'REJECTED_POSE';

        const sizeScore = Math.min(1, Math.min((box.width || 0) / 220, (box.height || 0) / 220));
        const poseQuality = Number.isFinite(poseScore) ? Math.max(0, 1 - poseScore / 0.22) : 0.8;
        const qualityScore = Math.max(0, Math.min(1, (detectionScore * 0.6) + (sizeScore * 0.25) + (poseQuality * 0.15)));

        return {
            passed: reason === null,
            reason,
            faceCount,
            detectionScore: parseFloat(detectionScore.toFixed(4)),
            faceBox: {
                width: Math.round(box.width || 0),
                height: Math.round(box.height || 0)
            },
            inputSize,
            blurScore: null,
            poseScore: Number.isFinite(poseScore) ? parseFloat(poseScore.toFixed(4)) : null,
            qualityScore: parseFloat(qualityScore.toFixed(4))
        };
    }

    /**
     * Analyze all visible faces and extract one descriptor when quality passes.
     * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} input
     * @returns {Promise<{descriptor: number[]|null, score: number, box: object, quality: object}>}
     */
    async function analyze(input) {
        if (!modelsLoaded) {
            throw new Error('Model AI belum dimuat. Panggil FaceAI.load() dulu.');
        }

        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.5
        });

        const results = await faceapi
            .detectAllFaces(input, options)
            .withFaceLandmarks(true) // true = use tiny landmark model
            .withFaceDescriptors();

        const faceCount = results.length;
        const result = faceCount === 1 ? results[0] : null;
        const quality = buildQuality(result, faceCount, input);

        if (!result || !quality.passed) {
            return {
                descriptor: null,
                score: quality.detectionScore || 0,
                box: quality.faceBox,
                quality
            };
        }

        return {
            descriptor: Array.from(result.descriptor),
            score: result.detection.score,
            box: result.detection.box,
            quality
        };
    }

    /**
     * Detect a single face and extract 128-dim descriptor.
     * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} input
     * @returns {Promise<{descriptor: number[], score: number, box: object, quality: object}|null>}
     */
    async function detectAndExtract(input) {
        const result = await analyze(input);
        if (!result.descriptor) return null;

        return result;
    }

    /**
     * Detect face from a base64 image data URL.
     * Creates a temporary Image element for processing.
     * @param {string} dataUrl - Base64 image data URL
     * @returns {Promise<{descriptor: number[], score: number}|null>}
     */
    async function detectFromImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const result = await detectAndExtract(img);
                    resolve(result);
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error('Gagal memuat gambar.'));
            img.src = dataUrl;
        });
    }

    /**
     * Detect face directly from a video element (live camera).
     * @param {HTMLVideoElement} video
     * @returns {Promise<{descriptor: number[], score: number}|null>}
     */
    async function detectFromVideo(video) {
        return detectAndExtract(video);
    }

    /**
     * Calculate Euclidean distance between two face descriptors.
     * Lower distance = more similar faces.
     * @returns {number} distance (0 = identical, >0.6 = different person)
     */
    function euclideanDistance(desc1, desc2) {
        if (desc1.length !== desc2.length) throw new Error('Descriptor length mismatch');
        let sum = 0;
        for (let i = 0; i < desc1.length; i++) {
            sum += (desc1[i] - desc2[i]) ** 2;
        }
        return Math.sqrt(sum);
    }

    /**
     * Convert Euclidean distance to similarity score (0-1).
     * @returns {{ match: boolean, score: number, distance: number }}
     */
    function compareDescriptors(desc1, desc2, threshold = 0.5) {
        const distance = euclideanDistance(desc1, desc2);
        const score = Math.max(0, 1 - distance);
        return {
            match: distance < threshold,
            score: parseFloat(score.toFixed(4)),
            distance: parseFloat(distance.toFixed(4))
        };
    }

    return {
        load,
        isReady,
        analyze,
        detectAndExtract,
        detectFromImage,
        detectFromVideo,
        euclideanDistance,
        compareDescriptors
    };
})();
