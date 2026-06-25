-- =====================================================
--  Face Provider Mismatch Diagnosis — SQL Queries
--  Jalankan di Supabase SQL Editor
-- =====================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- ⚠️  MIGRATION WAJIB — Jalankan SETELAH deploy face-service baru
-- ══════════════════════════════════════════════════════════════════════════════
-- Root cause: cv2.FaceRecognizerSF.feature() mengembalikan raw output (norm ~10+).
-- Embedding lama tersimpan un-normalized → tidak bisa dibandingkan dengan
-- embedding baru yang sudah L2-normalized (norm=1.0) dari fix terbaru.
-- Semua pegawai HARUS re-register untuk mendapat embedding yang konsisten.
-- ══════════════════════════════════════════════════════════════════════════════

-- Jalankan query ini SEKALI setelah deploy face-service baru:
UPDATE pegawai
SET
    status_wajah            = false,
    face_embeddings         = '[]'::jsonb,
    vektor_wajah            = NULL,
    face_enrollment_version = 1,
    face_model_provider     = NULL,
    face_registered_at      = NULL,
    face_quality_summary    = '{}'::jsonb
WHERE
    role = 'pegawai'
    AND status_wajah = true;

-- Verifikasi hasilnya (harus 0 baris yang masih registered):
-- SELECT COUNT(*) FROM pegawai WHERE role = 'pegawai' AND status_wajah = true;

-- ══════════════════════════════════════════════════════════════════════════════



-- ── 1. LIHAT SEMUA PEGAWAI & STATUS PROVIDER EMBEDDING ──────────────────────
--
--  face_enrollment_version:
--    1 = belum pernah registrasi / setelah reset
--    2 = registrasi dengan face-api.js (FaceRecognitionNet) ← MISMATCH jika pakai SFace
--    3 = registrasi dengan SFace (opencv_sface)             ← BENAR jika FACE_PROVIDER=opencv_sface
-- ──────────────────────────────────────────────────────────────────────────────
SELECT
    id_pegawai,
    nama_lengkap,
    status_wajah,
    face_enrollment_version,
    face_model_provider,
    face_registered_at,
    CASE
        WHEN status_wajah = false OR face_embeddings IS NULL OR face_embeddings = '[]'::jsonb
            THEN '⬜ Belum registrasi'
        WHEN face_model_provider = 'opencv_sface' AND face_enrollment_version >= 3
            THEN '✅ OK (SFace)'
        WHEN face_model_provider = 'faceapi' OR face_enrollment_version = 2
            THEN '❌ MISMATCH — registrasi pakai face-api.js'
        WHEN face_enrollment_version IS NULL OR face_model_provider IS NULL
            THEN '⚠️  Data tidak lengkap'
        ELSE '❓ Unknown'
    END AS diagnosis,
    jsonb_array_length(COALESCE(face_embeddings, '[]'::jsonb)) AS jumlah_embedding
FROM
    pegawai
WHERE
    role = 'pegawai'
ORDER BY
    diagnosis, nama_lengkap;


-- ── 2. HANYA TAMPILKAN YANG BERMASALAH (MISMATCH) ───────────────────────────
SELECT
    id_pegawai,
    nama_lengkap,
    face_enrollment_version,
    face_model_provider,
    face_registered_at,
    jsonb_array_length(COALESCE(face_embeddings, '[]'::jsonb)) AS jumlah_embedding
FROM
    pegawai
WHERE
    role = 'pegawai'
    AND status_wajah = true
    AND (
        face_model_provider != 'opencv_sface'
        OR face_enrollment_version < 3
        OR face_model_provider IS NULL
    )
ORDER BY
    nama_lengkap;


-- ── 3. CEK DIMENSI EMBEDDING SAMPLE ─────────────────────────────────────────
--  Kedua model (SFace & face-api.js) menghasilkan 128-dim, jadi shape sama.
--  Yang beda adalah nilai angkanya (ruang fitur beda).
--  Query ini cek apakah ada embedding dengan dimensi aneh.
SELECT
    id_pegawai,
    nama_lengkap,
    face_model_provider,
    face_enrollment_version,
    jsonb_array_length(COALESCE(face_embeddings->0, '[]'::jsonb)) AS dim_embedding_pertama
FROM
    pegawai
WHERE
    role = 'pegawai'
    AND face_embeddings IS NOT NULL
    AND jsonb_array_length(face_embeddings) > 0
ORDER BY
    dim_embedding_pertama, nama_lengkap;


-- ── 4. SUMMARY STATISTIK ────────────────────────────────────────────────────
SELECT
    face_model_provider,
    face_enrollment_version,
    COUNT(*) AS jumlah_pegawai,
    COUNT(*) FILTER (WHERE status_wajah = true) AS sudah_registrasi
FROM
    pegawai
WHERE
    role = 'pegawai'
GROUP BY
    face_model_provider,
    face_enrollment_version
ORDER BY
    face_enrollment_version;


-- ── 5. RESET MANUAL — Jalankan HANYA jika sudah yakin ada mismatch ──────────
--  ⚠️  HATI-HATI: ini akan menghapus semua embedding pegawai bermasalah.
--  Ganti kondisi WHERE sesuai kebutuhan.
--  Setelah ini, pegawai harus registrasi ulang wajah dari halaman /register-face.
--
-- UPDATE pegawai
-- SET
--     status_wajah            = false,
--     face_embeddings         = '[]'::jsonb,
--     vektor_wajah            = NULL,
--     face_enrollment_version = 1,
--     face_model_provider     = NULL,
--     face_registered_at      = NULL,
--     face_quality_summary    = '{}'::jsonb
-- WHERE
--     role = 'pegawai'
--     AND status_wajah = true
--     AND (
--         face_model_provider != 'opencv_sface'
--         OR face_enrollment_version < 3
--     );


-- ── 6. AUDIT LOG — Lihat riwayat reset wajah ────────────────────────────────
SELECT
    created_at,
    aksi,
    detail->>'id_pegawai'  AS id_pegawai,
    detail->>'nama'        AS nama_pegawai,
    detail->>'alasan'      AS alasan
FROM
    audit_log
WHERE
    aksi = 'RESET_WAJAH'
ORDER BY
    created_at DESC
LIMIT 50;
