const FACE_DESCRIPTOR_LENGTH = 128;
const FACE_MATCH_THRESHOLD = 0.5;

function normalizeDescriptor(descriptor) {
    if (!Array.isArray(descriptor) || descriptor.length !== FACE_DESCRIPTOR_LENGTH) {
        return null;
    }

    const normalized = descriptor.map(Number);
    if (normalized.some(value => !Number.isFinite(value))) {
        return null;
    }

    return normalized;
}

function compareDescriptors(candidateDescriptor, masterDescriptor, threshold = FACE_MATCH_THRESHOLD) {
    const candidate = normalizeDescriptor(candidateDescriptor);
    const master = normalizeDescriptor(masterDescriptor);

    if (!candidate || !master) {
        return null;
    }

    let sum = 0;
    for (let i = 0; i < FACE_DESCRIPTOR_LENGTH; i++) {
        sum += (candidate[i] - master[i]) ** 2;
    }

    const distance = Math.sqrt(sum);
    const score = Math.max(0, 1 - distance);

    return {
        match: distance < threshold,
        score: parseFloat(score.toFixed(4)),
        distance: parseFloat(distance.toFixed(4)),
        threshold
    };
}

module.exports = {
    FACE_DESCRIPTOR_LENGTH,
    FACE_MATCH_THRESHOLD,
    normalizeDescriptor,
    compareDescriptors
};
