const { FACE_MATCH_THRESHOLD } = require('../utils/face-match');

const FACE_PROVIDER = process.env.FACE_PROVIDER || 'faceapi';
const FACE_SERVICE_URL = (process.env.FACE_SERVICE_URL || '').replace(/\/+$/, '');
const FACE_SERVICE_API_KEY = process.env.FACE_SERVICE_API_KEY || '';
const FACE_SERVICE_TIMEOUT_MS = Number(process.env.FACE_SERVICE_TIMEOUT_MS || 10000);
const FACE_THRESHOLD_DEFAULT = Number(process.env.FACE_THRESHOLD_DEFAULT || FACE_MATCH_THRESHOLD);

function isOpenCvSFaceProvider() {
    return FACE_PROVIDER === 'opencv_sface';
}

function assertConfigured() {
    if (!FACE_SERVICE_URL || !FACE_SERVICE_API_KEY) {
        throw new Error('FACE_SERVICE_URL dan FACE_SERVICE_API_KEY wajib diisi untuk FACE_PROVIDER=opencv_sface.');
    }
}

function toBlob(image) {
    return new Blob([image.buffer], { type: image.mimeType || 'image/jpeg' });
}

function mapFaceServiceCode(code) {
    const map = {
        NO_FACE: 'REJECTED_NO_FACE',
        MULTIPLE_FACES: 'REJECTED_MULTIPLE_FACES',
        LOW_CONFIDENCE: 'REJECTED_LOW_CONFIDENCE',
        FACE_TOO_SMALL: 'REJECTED_FACE_TOO_SMALL',
        BLURRY_IMAGE: 'REJECTED_BLUR',
        BAD_POSE: 'REJECTED_POSE',
        INVALID_IMAGE: 'REJECTED_INVALID_IMAGE',
        MODEL_NOT_READY: 'REJECTED_FACE_SERVICE_ERROR',
        FACE_SERVICE_ERROR: 'REJECTED_FACE_SERVICE_ERROR',
        FACE_SERVICE_TIMEOUT: 'REJECTED_FACE_SERVICE_ERROR'
    };

    return map[code] || 'REJECTED_FACE_SERVICE_ERROR';
}

function friendlyFaceServiceMessage(code) {
    const messages = {
        NO_FACE: 'Wajah tidak terdeteksi. Pastikan wajah terlihat jelas lalu coba lagi.',
        MULTIPLE_FACES: 'Terdeteksi lebih dari satu wajah. Pastikan hanya Anda yang terlihat di kamera.',
        LOW_CONFIDENCE: 'Foto kurang jelas. Pastikan pencahayaan cukup dan wajah berada di tengah kamera.',
        FACE_TOO_SMALL: 'Wajah terlalu jauh dari kamera. Dekatkan wajah lalu coba lagi.',
        BLURRY_IMAGE: 'Foto terlalu blur. Pegang kamera lebih stabil lalu coba lagi.',
        BAD_POSE: 'Wajah terlalu miring. Hadapkan wajah ke kamera lalu coba lagi.',
        INVALID_IMAGE: 'Gambar wajah tidak valid. Silakan ambil ulang foto.',
        MODEL_NOT_READY: 'Sistem verifikasi wajah sedang menyala ulang. Silakan coba lagi beberapa saat.',
        FACE_SERVICE_TIMEOUT: 'Sistem verifikasi wajah sedang lambat. Silakan coba lagi beberapa saat.',
        FACE_SERVICE_ERROR: 'Sistem verifikasi wajah belum siap. Silakan coba lagi beberapa saat.'
    };

    return messages[code] || messages.FACE_SERVICE_ERROR;
}

async function requestFaceService(path, formData) {
    assertConfigured();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FACE_SERVICE_TIMEOUT_MS);

    try {
        const response = await fetch(`${FACE_SERVICE_URL}${path}`, {
            method: 'POST',
            headers: {
                'x-api-key': FACE_SERVICE_API_KEY
            },
            body: formData,
            signal: controller.signal
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                success: false,
                code: data.code || 'FACE_SERVICE_ERROR',
                message: data.message || friendlyFaceServiceMessage(data.code)
            };
        }

        return data;
    } catch (err) {
        if (err.name === 'AbortError') {
            return {
                success: false,
                code: 'FACE_SERVICE_TIMEOUT',
                message: friendlyFaceServiceMessage('FACE_SERVICE_TIMEOUT')
            };
        }

        return {
            success: false,
            code: 'FACE_SERVICE_ERROR',
            message: friendlyFaceServiceMessage('FACE_SERVICE_ERROR')
        };
    } finally {
        clearTimeout(timeout);
    }
}

async function extractFaceWithService(image) {
    const formData = new FormData();
    formData.append('image', toBlob(image), image.filename || 'face.jpg');

    return requestFaceService('/api/face/extract', formData);
}

async function verifyFaceWithService({ image, embeddings, threshold = FACE_THRESHOLD_DEFAULT }) {
    const formData = new FormData();
    formData.append('image', toBlob(image), image.filename || 'selfie.jpg');
    formData.append('embeddings', JSON.stringify(embeddings));
    formData.append('threshold', String(threshold));

    return requestFaceService('/api/face/verify', formData);
}

async function healthCheckFaceService() {
    assertConfigured();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FACE_SERVICE_TIMEOUT_MS);

    try {
        const response = await fetch(`${FACE_SERVICE_URL}/health`, {
            signal: controller.signal
        });
        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    FACE_PROVIDER,
    FACE_THRESHOLD_DEFAULT,
    isOpenCvSFaceProvider,
    extractFaceWithService,
    verifyFaceWithService,
    healthCheckFaceService,
    mapFaceServiceCode,
    friendlyFaceServiceMessage
};
