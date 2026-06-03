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

    /**
     * Detect a single face and extract 128-dim descriptor.
     * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} input
     * @returns {Promise<{descriptor: number[], score: number, box: object}|null>}
     */
    async function detectAndExtract(input) {
        if (!modelsLoaded) {
            throw new Error('Model AI belum dimuat. Panggil FaceAI.load() dulu.');
        }

        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.5
        });

        const result = await faceapi
            .detectSingleFace(input, options)
            .withFaceLandmarks(true) // true = use tiny landmark model
            .withFaceDescriptor();

        if (!result) return null;

        return {
            descriptor: Array.from(result.descriptor), // Float32Array → number[]
            score: result.detection.score,
            box: result.detection.box
        };
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
    function compareDescriptors(desc1, desc2, threshold = 0.6) {
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
        detectAndExtract,
        detectFromImage,
        detectFromVideo,
        euclideanDistance,
        compareDescriptors
    };
})();
