# 📸 Sistem Absensi Cerdas — Klinik Prima Insani

<div align="center">
  <img src="https://img.shields.io/badge/Status-Hardening_Beta-yellow?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Platform-PWA_%7C_Web-blue?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/AI-Face_Recognition-orange?style=for-the-badge" alt="AI" />
  <img src="https://img.shields.io/badge/License-MIT-blueviolet?style=for-the-badge" alt="License" />
</div>

<br />

Sistem Absensi Cerdas Klinik Prima Insani adalah solusi perangkat lunak berbasis web yang dirancang untuk mendigitalisasi dan memperkuat proses presensi pegawai klinik.

Dibangun sebagai ekosistem absensi tanpa instalasi berbasis **Progressive Web App (PWA)** yang diperkuat dengan kecerdasan buatan (Face Recognition), validasi lokasi (Geo-Fencing), dan otomasi shift.

---

## 🎯 Mengapa Sistem Ini Dibuat?

Sistem ini dirancang untuk mengurangi masalah umum pada absensi tradisional dan aplikasi mobile standar:
1. **Mengurangi Kecurangan**: Menggabungkan verifikasi wajah live, validasi radius lokasi, timestamp server, dan proteksi absen ganda.
2. **Tanpa Installasi Rumit**: PWA bekerja langsung dari browser, bebas dari kendala _storage_ penuh pada HP pegawai.
3. **Low-Cost Biometric Descriptor**: Foto diproses di browser menjadi vektor wajah 128 dimensi; backend menyimpan descriptor dan log absensi, bukan arsip foto selfie harian.
4. **Otomasi Shift**: Meringankan beban administratif HRD; sistem otomatis tahu siapa yang terlambat dan di shift mana dia absen.

---

## ✨ Fitur Unggulan

### 📱 Modul Pegawai (PWA Mobile)
- 🤳 **Self-Service Biometric Onboarding:** Pegawai setup wajah mereka sendiri saat pertama kali login.
- 📸 **Live-Capture Flow:** Absensi memakai stream kamera langsung dan tidak menerima upload file gambar.
- 📍 **Dynamic Geo-Fencing:** Tombol absen dibatasi oleh radius klinik, dan API tetap memvalidasi koordinat sebelum menyimpan data.
- ⚡ **Offline Awareness:** Deteksi cerdas jika koneksi internet terputus.

### 🧠 Modul Keamanan & AI (API Server)
- 🤖 **Server-Enforced Face Matching:** Backend wajib mencocokkan descriptor wajah live sebelum menyimpan absensi.
- ⏳ **Server-Side Timestamp:** Mengunci waktu presensi dari server. Memajukan/memundurkan jam di HP tidak akan berguna.
- 🚦 **Smart Auto-Shift:** Otomatis menentukan Shift Pagi atau Siang dan kalkulasi keterlambatan.

### 💻 Web Dashboard Admin
- 📊 **Real-time Overview:** Tampilan statistik harian kehadiran, alpa, dan telat.
- 🗺️ **Bukti Koordinat:** Melihat koordinat dan jarak lokasi absen sebagai bukti audit.
- 📄 **Laporan Riwayat:** Meninjau dan memfilter riwayat presensi; export payroll masih masuk backlog.
- 🕵️ **Biometric Moderation:** Reset wajah pegawai jika terindikasi foto palsu/fraud.

---

## 🛠️ Tech Stack Dasar

Sistem ini dirancang sangat ringan, tidak membutuhkan bundler kompleks untuk frontend.

- **Frontend:** HTML5, CSS3, Vanilla JS, Tailwind CSS (Dashboard)
- **Backend:** Node.js, Express.js
- **AI Engine:** face-api.js (default) atau OpenCV YuNet/SFace via Hugging Face Space
- **Database:** Supabase (PostgreSQL)
- **Security:** JWT Authentication, Bcrypt

---

## 🚀 Quick Start (Panduan Instalasi)

### 1. Kloning Repositori
```bash
git clone https://github.com/username/absensi-klinik.git
cd absensi-klinik
```

### 2. Setup Database (Supabase)
Masuk ke SQL Editor di Supabase Anda dan jalankan script migrasi yang ada di:
> `backend/database/migration.sql`

Script ini akan otomatis membuatkan tabel: `pengaturan_klinik`, `master_shift`, `pegawai`, `log_absensi`, dan `audit_log` beserta pengaturan klinik dan shift default. Script ini tidak membuat akun admin default.

### 3. Setup Backend
Masuk ke direktori backend, konfigurasi enviroment, lalu jalankan.
```bash
cd backend
npm install
```
Salin template konfigurasi:
```bash
cp .env.example .env
```
*(Buka `.env` dan isi `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, serta `ALLOWED_ORIGINS` untuk production)*

Buat admin pertama:
```bash
npm run create-admin -- --username admin --password "password-kuat-minimal-12" --name "Administrator"
```

Start server:
```bash
npm run dev
```

### 4. Menjalankan Frontend
Karena ini Vanilla HTML/JS, Anda bisa menggunakan extension seperti **Live Server** di VS Code.
- Klik kanan `index.html` > *Open with Live Server*
- Atau host menggunakan statis server ringan seperti `npx serve .`

---

## 📁 Struktur Repo

```text
absensi-klinik/
├── admin/                 # 💻 Dashboard Web Admin
├── pegawai/               # 📱 Aplikasi Web PWA Pegawai
├── backend/               # ⚙️ Node.js API (AI, Auth, Logic)
│   ├── database/          # Skema SQL Supabase
│   ├── config/            # Konfigurasi Cloud
│   ├── routes/            # API Endpoints
│   └── ...
├── face-service/          # 🧠 FastAPI Docker Space untuk YuNet/SFace
├── shared/                # 🎨 Asset yang dipakai bersama
├── prd.md                 # 📄 Detail dokumen arsitektur (Super Lengkap!)
└── vercel.json            # Deployment config jika memakai Vercel
```

### Face Provider: Hugging Face YuNet/SFace
Flow default tetap `FACE_PROVIDER=faceapi`. Untuk migrasi OpenCV SFace:

1. Deploy folder `face-service/` sebagai Hugging Face Docker Space.
2. Set Hugging Face secret `FACE_SERVICE_API_KEY`.
3. Set env backend/Vercel:
   ```text
   FACE_PROVIDER=opencv_sface
   FACE_SERVICE_URL=https://<username>-klinik-face-service.hf.space
   FACE_SERVICE_API_KEY=<same-as-hugging-face-secret>
   FACE_SERVICE_TIMEOUT_MS=10000
   FACE_THRESHOLD_DEFAULT=0.50
   JSON_BODY_LIMIT=7mb
   ```
4. Jalankan ulang migration Supabase agar kolom `face_model_provider` dan `face_provider` tersedia.
5. Minta pegawai registrasi ulang wajah agar `face_embeddings` berisi embedding SFace.

---

## 📄 Dokumentasi Ekstensif
Jika Anda ingin memahami *Business Flow*, Diagram Arsitektur, Skema Database lengkap, dan *Edge Cases*, kami sangat menyarankan membaca [Product Requirements Document (prd.md)](./prd.md).

---

## ⚖️ Lisensi
Proyek ini dilisensikan di bawah [MIT License](./LICENSE). Silakan gunakan dan modifikasi sesuai kebutuhan Anda. Dipersembahkan untuk mentransformasi klinik menjadi fasilitas pintar.
