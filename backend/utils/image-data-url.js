const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = Number(process.env.MAX_FACE_IMAGE_BYTES || 5 * 1024 * 1024);

function parseImageDataUrl(dataUrl) {
    if (typeof dataUrl !== 'string') {
        return null;
    }

    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
        return null;
    }

    const mimeType = match[1];
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return null;
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
        return null;
    }

    return {
        buffer,
        mimeType,
        filename: mimeType === 'image/png'
            ? 'face.png'
            : mimeType === 'image/webp'
                ? 'face.webp'
                : 'face.jpg'
    };
}

module.exports = {
    parseImageDataUrl
};
