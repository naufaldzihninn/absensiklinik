-- =====================================================
-- Sistem Absensi Cerdas — Klinik Prima Insani
-- Database Migration Script (Supabase / PostgreSQL)
-- Jalankan di: Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────
-- 2. TABEL: pengaturan_klinik
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pengaturan_klinik (
  id            SERIAL PRIMARY KEY,
  nama_klinik   VARCHAR(255) NOT NULL DEFAULT 'Klinik Prima Insani',
  latitude      DECIMAL(10,7) NOT NULL DEFAULT -6.2000000,
  longitude     DECIMAL(10,7) NOT NULL DEFAULT 106.8166660,
  batas_radius_meter INT NOT NULL DEFAULT 50,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID
);

-- ─────────────────────────────────────────────────────
-- 3. TABEL: master_shift
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS master_shift (
  id_shift              SERIAL PRIMARY KEY,
  nama_shift            VARCHAR(50) NOT NULL,
  batas_jam_mulai_scan  TIME NOT NULL,
  batas_jam_akhir_scan  TIME NOT NULL,
  jam_masuk_ideal       TIME NOT NULL,
  jam_pulang_ideal      TIME NOT NULL
);

-- ─────────────────────────────────────────────────────
-- 4. TABEL: pegawai
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pegawai (
  id_pegawai      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username        VARCHAR(100) UNIQUE NOT NULL,
  password        VARCHAR(255) NOT NULL,
  nama_lengkap    VARCHAR(255) NOT NULL,
  role            VARCHAR(20) NOT NULL DEFAULT 'pegawai' CHECK (role IN ('pegawai', 'admin')),
  foto_master_url VARCHAR(500),
  vektor_wajah    JSONB,
  status_wajah    BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pegawai_updated_at
  BEFORE UPDATE ON pegawai
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────
-- 5. TABEL: log_absensi
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS log_absensi (
  id_absen          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_pegawai        UUID NOT NULL REFERENCES pegawai(id_pegawai) ON DELETE CASCADE,
  id_shift          INT REFERENCES master_shift(id_shift),
  tipe_absen        VARCHAR(10) NOT NULL CHECK (tipe_absen IN ('MASUK', 'PULANG')),
  waktu_absen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  koordinat_absen   VARCHAR(100),
  jarak_meter       DECIMAL(10,2),
  status_kehadiran  VARCHAR(20) DEFAULT 'Tepat Waktu',
  akurasi_wajah     DECIMAL(5,4),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_log_absensi_pegawai ON log_absensi(id_pegawai);
CREATE INDEX IF NOT EXISTS idx_log_absensi_waktu ON log_absensi(waktu_absen);
CREATE INDEX IF NOT EXISTS idx_log_absensi_tipe ON log_absensi(tipe_absen);

-- ─────────────────────────────────────────────────────
-- 6. TABEL: audit_log
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id_log      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_admin    UUID REFERENCES pegawai(id_pegawai),
  aksi        VARCHAR(50) NOT NULL,
  detail      JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(id_admin);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- ─────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────
-- Disable RLS for now (backend uses service_role key)
-- Will enable granular policies in production
ALTER TABLE pengaturan_klinik DISABLE ROW LEVEL SECURITY;
ALTER TABLE master_shift DISABLE ROW LEVEL SECURITY;
ALTER TABLE pegawai DISABLE ROW LEVEL SECURITY;
ALTER TABLE log_absensi DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────
-- 8. SEED DATA
-- ─────────────────────────────────────────────────────

-- Default clinic settings
INSERT INTO pengaturan_klinik (nama_klinik, latitude, longitude, batas_radius_meter)
VALUES ('Klinik Prima Insani', -6.2000000, 106.8166660, 50)
ON CONFLICT DO NOTHING;

-- Default shifts
INSERT INTO master_shift (nama_shift, batas_jam_mulai_scan, batas_jam_akhir_scan, jam_masuk_ideal, jam_pulang_ideal)
VALUES 
  ('Pagi', '04:00:00', '11:59:59', '07:00:00', '14:00:00'),
  ('Siang', '12:00:00', '20:00:00', '14:00:00', '21:00:00')
ON CONFLICT DO NOTHING;

-- Default admin account (password: admin123, pre-hashed with bcrypt)
-- Hash generated with bcryptjs.hashSync('admin123', 10)
INSERT INTO pegawai (username, password, nama_lengkap, role, is_active)
VALUES (
  'admin',
  '$2a$10$LO931Hv9sxI4bXV.1Rq/A.bXMz8GHhuopjs/T1t47lGeGScxtwUau',
  'Administrator',
  'admin',
  TRUE
)
ON CONFLICT (username) DO NOTHING;

-- Default employee accounts for testing (password: password123)
INSERT INTO pegawai (username, password, nama_lengkap, role, is_active)
VALUES 
  ('budi.santoso', '$2a$10$lEg6XuKCHw25cLuBWwOHm.iHZepQpTuDw8NXh5rA1eOcpIs8OcrVq', 'Budi Santoso', 'pegawai', TRUE),
  ('siti.rahma', '$2a$10$lEg6XuKCHw25cLuBWwOHm.iHZepQpTuDw8NXh5rA1eOcpIs8OcrVq', 'Siti Rahma', 'pegawai', TRUE)
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- SELESAI! ✅
-- Pastikan tidak ada error di atas.
-- Tabel: pengaturan_klinik, master_shift, pegawai, 
--         log_absensi, audit_log
-- =====================================================
