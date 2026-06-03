function cleanString(value, maxLength = 255) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) return null;
    return trimmed;
}

function cleanUsername(value) {
    const username = cleanString(value, 100);
    if (!username) return null;
    const normalized = username.toLowerCase();
    if (!/^[a-z0-9._-]{3,100}$/.test(normalized)) return null;
    return normalized;
}

function cleanRole(value) {
    return ['pegawai', 'admin'].includes(value) ? value : null;
}

function cleanBoolean(value) {
    return typeof value === 'boolean' ? value : null;
}

function cleanNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) return null;
    return number;
}

function cleanInteger(value, min, max) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) return null;
    return number;
}

function cleanTime(value) {
    const text = cleanString(value, 8);
    if (!text) return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(text)) return null;
    return text.length === 5 ? `${text}:00` : text;
}

function cleanUuid(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
        return null;
    }
    return trimmed;
}

function cleanLimit(value, defaultValue = 50, max = 200) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return defaultValue;
    return Math.min(Math.max(parsed, 1), max);
}

function cleanOffset(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(parsed, 0);
}

module.exports = {
    cleanString,
    cleanUsername,
    cleanRole,
    cleanBoolean,
    cleanNumber,
    cleanInteger,
    cleanTime,
    cleanUuid,
    cleanLimit,
    cleanOffset
};
