# 📸 Sistem Absensi Cerdas — Klinik Prima Insani

<div align="center">
  <img src="https://img.shields.io/badge/Status-Production_Ready-success?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Platform-PWA_%7C_Web-blue?style=for-the-badge" alt="Platform" />
  <img src="https://img.shields.io/badge/AI-Face_Recognition-orange?style=for-the-badge" alt="AI" />
  <img src="https://img.shields.io/badge/License-MIT-blueviolet?style=for-the-badge" alt="License" />
</div>

<br />

Sistem Absensi Cerdas Klinik Prima Insani adalah solusi perangkat lunak *end-to-end* yang dirancang untuk mendigitalisasi dan mengamankan proses presensi pegawai klinik. 

Dibangun sebagai ekosistem absensi tanpa instalasi berbasis **Progressive Web App (PWA)** yang diperkuat dengan kecerdasan buatan (Face Recognition), validasi lokasi (Geo-Fencing), dan otomasi shift.

---

## 🎯 Mengapa Sistem Ini Dibuat?

Sistem ini dirancang untuk menyelesaikan masalah umum pada absensi tradisional dan aplikasi mobile standar:
1. **Mencegah Kecurangan**: Mematikan celah dari *Fake GPS* atau "titip absen".
2. **Tanpa Installasi Rumit**: PWA bekerja langsung dari browser, bebas dari kendala _storage_ penuh pada HP pegawai.
3. **Low-Cost (Zero-Storage RAM Processing)**: Meminimalkan biaya cloud storage secara revolusioner karena foto wajah diproses _on-the-fly_ di RAM server dan membuang sampah datanya, tidak menyimpannya selamanya.
4. **Otomasi Shift**: Meringankan beban administratif HRD; sistem otomatis tahu siapa yang terlambat dan di shift mana dia absen.

---

## ✨ Fitur Unggulan

### 📱 Modul Pegawai (PWA Mobile)
- 🤳 **Self-Service Biometric Onboarding:** Pegawai setup wajah mereka sendiri saat pertama kali login.
- 📸 **Strict Live-Capture:** Mengunci kamera hanya untuk foto *live*, mencegah upload gambar dari galeri/kamera virtual.
- 📍 **Dynamic Geo-Fencing:** Tombol absen akan membeku (terkunci) jika Anda berada di luar radius klinik.
- ⚡ **Offline Awareness:** Deteksi cerdas jika koneksi internet terputus.

### 🧠 Modul Keamanan & AI (API Server)
- 🤖 **On-the-fly Face Matching AI:** Pencocokan biometrik real-time dengan akurasi tinggi (Threshold ≥ 85%).
- ⏳ **Server-Side Timestamp:** Mengunci waktu presensi dari server. Memajukan/memundurkan jam di HP tidak akan berguna.
- 🚦 **Smart Auto-Shift:** Otomatis menentukan Shift Pagi atau Siang dan kalkulasi keterlambatan.

### 💻 Web Dashboard Admin
- 📊 **Real-time Overview:** Tampilan statistik harian kehadiran, alpa, dan telat.
- 🗺️ **Geospatial Map View:** Melihat bukti koordinat presisi pegawai di atas Peta Google/Leaflet.
- 📄 **One-Click Payroll Export:** Ekspor laporan presensi lengkap ke Format Excel (`.xlsx`) atau PDF dalam sekali klik.
- 🕵️ **Biometric Moderation:** Reset wajah pegawai jika terindikasi foto palsu/fraud.

---

## 🛠️ Tech Stack Dasar

Sistem ini dirancang sangat ringan, tidak membutuhkan bundler kompleks untuk frontend.

- **Frontend:** HTML5, CSS3, Vanilla JS, Tailwind CSS (Dashboard)
- **Backend:** Node.js, Express.js
- **AI Engine:** face-api.js (TensorFlow.js Core)
- **Database:** Supabase (PostgreSQL) + PostGIS
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

Script ini akan otomatis membuatkan tabel: `pengaturan_klinik`, `master_shift`, `pegawai`, `log_absensi`, dan `audit_log` beserta data default admin.

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
*(Buka `.env` dan isi `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, dan `JWT_SECRET` milik Anda)*

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
├── shared/                # 🎨 Asset yang dipakai bersama
├── prd.md                 # 📄 Detail dokumen arsitektur (Super Lengkap!)
└── vercel.json            # Deployment config jika memakai Vercel
```

---

## 📄 Dokumentasi Ekstensif
Jika Anda ingin memahami *Business Flow*, Diagram Arsitektur, Skema Database lengkap, dan *Edge Cases*, kami sangat menyarankan membaca [Product Requirements Document (prd.md)](./prd.md).

---

## ⚖️ Lisensi
Proyek ini dilisensikan di bawah [MIT License](./LICENSE). Silakan gunakan dan modifikasi sesuai kebutuhan Anda. Dipersembahkan untuk mentransformasi klinik menjadi fasilitas pintar.
