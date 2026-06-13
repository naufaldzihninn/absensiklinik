/* =====================================================
   Face Routes — Register, Match & Reset Face Data
   ===================================================== */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
    FACE_MATCH_THRESHOLD,
    normalizeFaceSample,
    normalizeStoredEmbeddings,
    validateFaceQuality,
    compareDescriptors,
    matchAgainstEmbeddings,
    summarizeEnrollment
} = require('../utils/face-match');
const { parseImageDataUrl } = require('../utils/image-data-url');
const {
    FACE_PROVIDER,
    extractFaceWithService,
    isOpenCvSFaceProvider,
    mapFaceServiceCode
} = require('../services/face-service-client');

router.use(verifyToken);

router.get('/config', (req, res) => {
    res.json({
        provider: FACE_PROVIDER,
        requireClientDescriptor: !isOpenCvSFaceProvider()
    });
});

function summarizeServiceEnrollment(validSamples, rejectedSamples = []) {
    const scores = validSamples
        .map(sample => Number(sample.quality?.detection_score ?? sample.quality?.detectionScore))
        .filter(Number.isFinite);

    return {
        provider: FACE_PROVIDER,
        sampleCount: validSamples.length,
        rejectedSamples: rejectedSamples.length,
        avgDetectionScore: scores.length > 0
            ? parseFloat((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(4))
            : null,
        generatedAt: new Date().toISOString()
    };
}

/**
 * POST /api/face/register
 * Register 5-7 live-camera face descriptor samples.
 * Body: { samples: [{ descriptor: number[], quality: object }] }
 */
router.post('/register', async (req, res) => {
    try {
        const userId = req.user.id_pegawai;
        const requestedSamples = Array.isArray(req.body.samples)
            ? req.body.samples
            : Array.isArray(req.body.descriptors)
                ? req.body.descriptors
                : [];

        if (requestedSamples.length < 5 || requestedSamples.length > 7) {
            return res.status(400).json({
                success: false,
                error: 'Ambil 5 foto wajah valid untuk menyelesaikan registrasi.',
                validSamples: 0,
                rejectedSamples: requestedSamples.length
            });
        }

        if (isOpenCvSFaceProvider()) {
            const validSamples = [];
            const errors = [];

            for (let index = 0; index < requestedSamples.length; index++) {
                const image = parseImageDataUrl(requestedSamples[index]?.image);
                if (!image) {
                    errors.push({ sample: index + 1, code: 'INVALID_IMAGE', reason: 'REJECTED_INVALID_IMAGE' });
                    continue;
                }

                const result = await extractFaceWithService(image);
                if (!result.success) {
                    errors.push({
                        sample: index + 1,
                        code: result.code,
                        reason: mapFaceServiceCode(result.code),
                        message: result.message
                    });
                    continue;
                }

                validSamples.push({
                    descriptor: result.embedding,
                    quality: result.quality
                });
            }

            if (validSamples.length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Minimal 5 foto wajah valid diperlukan. Ulangi foto yang gagal dengan pencahayaan lebih baik.',
                    validSamples: validSamples.length,
                    rejectedSamples: errors.length,
                    errors
                });
            }

            const embeddings = validSamples.map(sample => sample.descriptor);
            const qualitySummary = summarizeServiceEnrollment(validSamples, errors);

            const { data, error } = await supabase
                .from('pegawai')
                .update({
                    vektor_wajah: null,
                    face_embeddings: embeddings,
                    face_enrollment_version: 3,
                    face_model_provider: FACE_PROVIDER,
                    face_registered_at: new Date().toISOString(),
                    face_quality_summary: qualitySummary,
                    status_wajah: true
                })
                .eq('id_pegawai', userId)
                .select('id_pegawai, nama_lengkap, status_wajah, face_registered_at')
                .single();

            if (error) throw error;

            return res.json({
                success: true,
                data,
                validSamples: validSamples.length,
                rejectedSamples: errors.length,
                provider: FACE_PROVIDER,
                qualitySummary,
                message: 'Registrasi wajah berhasil! Anda sekarang bisa melakukan absensi.'
            });
        }

        const validSamples = [];
        const errors = [];

        requestedSamples.forEach((rawSample, index) => {
            const sample = normalizeFaceSample(rawSample);
            if (!sample) {
                errors.push({ sample: index + 1, reason: 'REJECTED_LOW_QUALITY' });
                return;
            }

            const quality = validateFaceQuality(sample.quality);
            if (!quality.passed) {
                errors.push({ sample: index + 1, reason: quality.reason, quality });
                return;
            }

            validSamples.push({
                descriptor: sample.descriptor,
                quality
            });
        });

        if (validSamples.length < 5) {
            return res.status(400).json({
                success: false,
                error: 'Minimal 5 foto wajah valid diperlukan. Ulangi foto yang gagal dengan pencahayaan lebih baik.',
                validSamples: validSamples.length,
                rejectedSamples: errors.length,
                errors
            });
        }

        const embeddings = validSamples.map((sample) => sample.descriptor);
        const qualitySummary = summarizeEnrollment(validSamples, errors);

        const { data, error } = await supabase
            .from('pegawai')
            .update({
                vektor_wajah: embeddings[0],
                face_embeddings: embeddings,
                face_enrollment_version: 2,
                face_model_provider: FACE_PROVIDER,
                face_registered_at: new Date().toISOString(),
                face_quality_summary: qualitySummary,
                status_wajah: true
            })
            .eq('id_pegawai', userId)
            .select('id_pegawai, nama_lengkap, status_wajah, face_registered_at')
            .single();

        if (error) throw error;

        res.json({
            success: true,
            data,
            validSamples: validSamples.length,
            rejectedSamples: errors.length,
            provider: FACE_PROVIDER,
            qualitySummary,
            message: 'Registrasi wajah berhasil! Anda sekarang bisa melakukan absensi.'
        });
    } catch (err) {
        console.error('Face register error:', err);
        res.status(500).json({ error: 'Gagal mendaftarkan wajah.' });
    }
});

/**
 * POST /api/face/match
 * Match one descriptor against all stored master embeddings.
 * Body: { descriptor: number[] }
 */
router.post('/match', async (req, res) => {
    try {
        const { descriptor } = req.body;
        const userId = req.user.id_pegawai;

        const sample = normalizeFaceSample(descriptor);
        if (!sample) {
            return res.status(400).json({ error: 'Data vektor wajah tidak valid.' });
        }

        const { data: pegawai } = await supabase
            .from('pegawai')
            .select('vektor_wajah, face_embeddings')
            .eq('id_pegawai', userId)
            .single();

        const masterDescriptors = normalizeStoredEmbeddings(pegawai);
        if (masterDescriptors.length === 0) {
            return res.status(400).json({ error: 'Wajah belum terdaftar.' });
        }

        const result = masterDescriptors.length === 1
            ? compareDescriptors(sample.descriptor, masterDescriptors[0])
            : matchAgainstEmbeddings(sample.descriptor, masterDescriptors, FACE_MATCH_THRESHOLD);

        if (!result) {
            return res.status(400).json({ error: 'Data vektor wajah tersimpan tidak valid.' });
        }

        res.json(result);
    } catch (err) {
        console.error('Face match error:', err);
        res.status(500).json({ error: 'Gagal memverifikasi wajah.' });
    }
});

/**
 * DELETE /api/face/reset/:id
 * Reset face data for an employee (Admin only)
 */
router.delete('/reset/:id', requireRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('pegawai')
            .update({
                vektor_wajah: null,
                face_embeddings: [],
                face_enrollment_version: 1,
                face_model_provider: FACE_PROVIDER,
                face_registered_at: null,
                face_quality_summary: {},
                foto_master_url: null,
                status_wajah: false
            })
            .eq('id_pegawai', id)
            .select('id_pegawai, nama_lengkap')
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Pegawai tidak ditemukan.' });

        await supabase.from('audit_log').insert({
            id_admin: req.user.id_pegawai,
            aksi: 'RESET_WAJAH',
            detail: { id_pegawai: id, nama: data.nama_lengkap }
        });

        res.json({ message: `Wajah "${data.nama_lengkap}" berhasil direset.` });
    } catch (err) {
        console.error('Face reset error:', err);
        res.status(500).json({ error: 'Gagal mereset wajah.' });
    }
});

module.exports = router;
