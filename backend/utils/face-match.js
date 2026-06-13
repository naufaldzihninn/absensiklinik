const FACE_DESCRIPTOR_LENGTH = 128;
const FACE_MATCH_THRESHOLD = 0.5;
const MIN_DETECTION_SCORE = 0.75;
const MIN_FACE_SIZE = 120;
const MAX_EYE_TILT = 0.22;

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

function normalizeFaceSample(sample) {
    if (Array.isArray(sample)) {
        const descriptor = normalizeDescriptor(sample);
        return descriptor ? { descriptor, quality: null } : null;
    }

    if (!sample || typeof sample !== 'object') {
        return null;
    }

    const descriptor = normalizeDescriptor(sample.descriptor);
    if (!descriptor) {
        return null;
    }

    return {
        descriptor,
        quality: sample.quality || {
            detectionScore: sample.score,
            faceBox: sample.box
        }
    };
}

function normalizeStoredEmbeddings(pegawai = {}) {
    const embeddings = [];

    if (Array.isArray(pegawai.face_embeddings)) {
        pegawai.face_embeddings.forEach((descriptor) => {
            const normalized = normalizeDescriptor(descriptor);
            if (normalized) embeddings.push(normalized);
        });
    }

    const legacyDescriptor = normalizeDescriptor(pegawai.vektor_wajah);
    if (legacyDescriptor) {
        const alreadyIncluded = embeddings.some((descriptor) => {
            return descriptor.every((value, index) => value === legacyDescriptor[index]);
        });
        if (!alreadyIncluded) embeddings.push(legacyDescriptor);
    }

    return embeddings;
}

function validateFaceQuality(quality, options = {}) {
    const {
        requireQuality = true,
        minDetectionScore = MIN_DETECTION_SCORE,
        minFaceSize = MIN_FACE_SIZE,
        maxEyeTilt = MAX_EYE_TILT
    } = options;

    if (!quality) {
        return requireQuality
            ? { passed: false, reason: 'REJECTED_LOW_QUALITY' }
            : { passed: true, reason: null, qualityScore: null };
    }

    if (quality.reason && quality.passed === false) {
        return { ...quality, passed: false, reason: quality.reason };
    }

    const faceCount = Number(quality.faceCount ?? 1);
    if (faceCount < 1) return { ...quality, passed: false, reason: 'REJECTED_NO_FACE' };
    if (faceCount > 1) return { ...quality, passed: false, reason: 'REJECTED_MULTIPLE_FACES' };

    const detectionScore = Number(quality.detectionScore ?? quality.score);
    if (!Number.isFinite(detectionScore) || detectionScore < minDetectionScore) {
        return { ...quality, passed: false, reason: 'REJECTED_LOW_QUALITY' };
    }

    const faceBox = quality.faceBox || quality.box || {};
    const width = Number(faceBox.width);
    const height = Number(faceBox.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < minFaceSize || height < minFaceSize) {
        return { ...quality, passed: false, reason: 'REJECTED_LOW_QUALITY' };
    }

    const poseScore = Number(quality.poseScore);
    if (Number.isFinite(poseScore) && poseScore > maxEyeTilt) {
        return { ...quality, passed: false, reason: 'REJECTED_POSE' };
    }

    const qualityScore = Number.isFinite(Number(quality.qualityScore))
        ? Number(quality.qualityScore)
        : Math.min(1, Math.max(0, detectionScore));

    return {
        ...quality,
        passed: true,
        reason: null,
        detectionScore,
        faceBox: { width, height },
        blurScore: quality.blurScore ?? null,
        poseScore: Number.isFinite(poseScore) ? poseScore : null,
        qualityScore: parseFloat(qualityScore.toFixed(4))
    };
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

function matchAgainstEmbeddings(candidateDescriptor, masterDescriptors, threshold = FACE_MATCH_THRESHOLD) {
    const candidate = normalizeDescriptor(candidateDescriptor);
    if (!candidate || !Array.isArray(masterDescriptors) || masterDescriptors.length === 0) {
        return null;
    }

    let best = null;
    masterDescriptors.forEach((masterDescriptor) => {
        const result = compareDescriptors(candidate, masterDescriptor, threshold);
        if (result && (!best || result.distance < best.distance)) {
            best = result;
        }
    });

    return best;
}

function average(values) {
    const finiteValues = values.filter(Number.isFinite);
    if (finiteValues.length === 0) return null;
    const total = finiteValues.reduce((sum, value) => sum + value, 0);
    return parseFloat((total / finiteValues.length).toFixed(4));
}

function summarizeEnrollment(validSamples, rejectedSamples = []) {
    const scores = validSamples.map((sample) => Number(sample.quality?.detectionScore));
    const qualityScores = validSamples.map((sample) => Number(sample.quality?.qualityScore));

    return {
        sampleCount: validSamples.length,
        rejectedSamples: rejectedSamples.length,
        avgDetectionScore: average(scores),
        avgQualityScore: average(qualityScores),
        generatedAt: new Date().toISOString()
    };
}

function evaluateAttendanceFrames(frames, masterDescriptors, options = {}) {
    const {
        threshold = FACE_MATCH_THRESHOLD,
        minValidFrames = 2,
        minMatchedFrames = 2,
        requireQuality = true
    } = options;

    const frameResults = [];
    let validFrames = 0;
    let matchedFrames = 0;
    let bestDistance = null;
    let bestScore = 0;
    let firstRejectReason = null;

    (Array.isArray(frames) ? frames : []).forEach((frame, index) => {
        const sample = normalizeFaceSample(frame);
        if (!sample) {
            const reason = 'REJECTED_LOW_QUALITY';
            if (!firstRejectReason) firstRejectReason = reason;
            frameResults.push({ index: index + 1, valid: false, matched: false, reason });
            return;
        }

        const quality = validateFaceQuality(sample.quality, { requireQuality });
        if (!quality.passed) {
            if (!firstRejectReason) firstRejectReason = quality.reason;
            frameResults.push({
                index: index + 1,
                valid: false,
                matched: false,
                reason: quality.reason,
                quality
            });
            return;
        }

        validFrames += 1;
        const match = matchAgainstEmbeddings(sample.descriptor, masterDescriptors, threshold);
        if (!match) {
            const reason = 'REJECTED_LOW_SIMILARITY';
            if (!firstRejectReason) firstRejectReason = reason;
            frameResults.push({ index: index + 1, valid: true, matched: false, reason, quality });
            return;
        }

        if (bestDistance === null || match.distance < bestDistance) {
            bestDistance = match.distance;
            bestScore = match.score;
        }

        if (match.match) matchedFrames += 1;

        frameResults.push({
            index: index + 1,
            valid: true,
            matched: match.match,
            distance: match.distance,
            score: match.score,
            threshold,
            quality
        });
    });

    const accepted = validFrames >= minValidFrames && matchedFrames >= minMatchedFrames;
    const decision = accepted
        ? 'ACCEPTED'
        : validFrames < minValidFrames
            ? (firstRejectReason || 'REJECTED_LOW_QUALITY')
            : 'REJECTED_LOW_SIMILARITY';

    return {
        accepted,
        decision,
        validFrames,
        matchedFrames,
        bestDistance,
        score: bestScore,
        thresholdUsed: threshold,
        frameResults
    };
}

module.exports = {
    FACE_DESCRIPTOR_LENGTH,
    FACE_MATCH_THRESHOLD,
    MIN_DETECTION_SCORE,
    MIN_FACE_SIZE,
    MAX_EYE_TILT,
    normalizeDescriptor,
    normalizeFaceSample,
    normalizeStoredEmbeddings,
    validateFaceQuality,
    compareDescriptors,
    matchAgainstEmbeddings,
    summarizeEnrollment,
    evaluateAttendanceFrames
};
