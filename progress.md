# Progress Hardening Absensi Klinik

Tanggal catatan: 2026-06-03 17:59 WIB

Catatan scope: worktree sudah berisi banyak file modified sebelum rangkaian hardening ini dimulai. Rekapan di bawah berfokus pada pekerjaan yang dilakukan dalam sesi perbaikan bertahap ini.

## Ringkasan Status

Project sudah naik dari MVP/demo internal menjadi hardening beta yang lebih aman. Backend sudah lebih kuat untuk deployment, auth, face verification, GPS validation, anti-duplikasi absensi, dependency security, migration bootstrap, dokumentasi, dan sebagian HTTP security headers.

Belum bisa disebut production-ready penuh karena masih ada beberapa pekerjaan penting: migrasi SQL harus dijalankan di Supabase, admin pertama perlu dibuat, E2E flow perlu dites di browser/perangkat nyata, CSP masih mengizinkan inline style, beberapa CDN frontend masih belum divendor, dan RLS/Supabase policy belum diaktifkan.

## Sudah Dikerjakan

### 1. Review awal project

- Membaca struktur project: `pegawai/`, `admin/`, `backend/`, `api/`, `shared/`.
- Mengidentifikasi stack utama: Vanilla HTML/CSS/JS, Express.js, Supabase PostgreSQL, face-api.js.
- Menemukan isu awal: Render production tidak listen, clock-in bisa bypass face/GPS, dependency audit merah, default credentials, README terlalu mengklaim production-ready.

### 2. Fix deployment server

- `backend/server.js` diubah agar server tetap `listen()` saat dijalankan langsung di Render/local, termasuk saat `NODE_ENV=production`.
- Vercel tetap memakai exported Express app lewat `api/index.js`.
- Verifikasi: `node --check backend/server.js` dan smoke start `npm start` berhasil.

### 3. Face verification dipaksa di backend

- Menambahkan `backend/utils/face-match.js`.
- `backend/routes/face.js` memakai helper validasi descriptor dan matching bersama.
- `backend/routes/absensi.js` sekarang wajib menerima descriptor wajah live dan melakukan server-side face matching sebelum insert absensi.
- `pegawai/js/api.js` dan `pegawai/absen.html` disesuaikan agar clock-in/clock-out mengirim descriptor, bukan sekadar `akurasi_wajah`.
- Dampak: endpoint absensi tidak lagi hanya percaya skor dari client.

### 4. GPS wajib valid dan server-side

- Menambahkan validasi koordinat latitude/longitude di backend.
- Clock-in dan clock-out sekarang wajib punya koordinat valid.
- Clock-out sekarang juga ditolak jika di luar radius klinik.
- Fallback koordinat default di `pegawai/absen.html` dihapus.
- Dampak: request tanpa GPS tidak lagi diam-diam memakai koordinat klinik.

### 5. Boundary tanggal WIB

- Menambahkan helper boundary hari WIB di `backend/routes/absensi.js`.
- Duplicate check clock-in/out memakai boundary WIB.
- Statistik `/api/absensi/today` dan `/api/absensi/weekly-trend` disamakan ke WIB.
- Dampak: dashboard tidak bergeser karena timezone server deployment.

### 6. Dependency audit bersih

- Menjalankan `npm audit fix --omit=dev` di `backend/`.
- Hasil akhir: `npm audit --omit=dev` = `0 vulnerabilities`.
- Paket relevan naik, termasuk `express`, `body-parser`, `path-to-regexp`, `qs`, dan `ws`.

### 7. Migration dan default credential hardening

- `backend/database/migration.sql` tidak lagi membuat akun default `admin/admin123` atau pegawai `password123`.
- Seed settings dibuat singleton `id=1`.
- Seed shift dibuat update-or-insert tanpa constraint baru yang berisiko merusak database lama.
- Trigger `pegawai_updated_at` dibuat aman rerun dengan `DROP TRIGGER IF EXISTS`.
- Menambahkan `backend/scripts/create-admin.js`.
- Menambahkan script `npm run create-admin`.
- README diarahkan untuk membuat admin pertama via script.
- File auth/mock legacy dibersihkan dari credential hardcoded.

### 8. JWT/session hardening

- `JWT_EXPIRES_IN` sekarang dari environment, default `8h`.
- `JWT_SECRET` fail-fast jika kosong.
- Middleware auth sekarang cek user terbaru ke database di setiap request.
- Token lama tidak lagi dipercaya jika user dihapus, dinonaktifkan, atau role berubah.

### 9. CORS production hardening

- `backend/server.js` memakai `ALLOWED_ORIGINS` saat `NODE_ENV=production`.
- Dev tetap longgar agar local testing tidak macet.
- `.env.example`, `render.yaml`, dan README ditambah konfigurasi `ALLOWED_ORIGINS`.

### 10. Validasi input API dan race protection

- Menambahkan `backend/utils/validation.js`.
- Login, pegawai CRUD, settings, shift, audit log, dan history query memakai validasi lebih ketat.
- Password pegawai minimal 8 karakter.
- Username dibatasi format aman.
- UUID param divalidasi.
- Latitude/longitude/radius/time/limit/offset divalidasi.
- Admin tidak bisa menonaktifkan atau menghapus dirinya sendiri lewat endpoint biasa.
- Menambahkan process-level attendance lock untuk mencegah double submit dalam satu proses backend.

### 11. DB-level unique guard absensi

- `backend/database/migration.sql` menambahkan unique index harian berbasis WIB:
  `idx_log_absensi_unique_daily_shift`.
- Index dibuat aman: jika data lama sudah duplikat, migration tidak gagal total, tetapi mengeluarkan notice.
- Query diagnostic duplikat ditambahkan sebagai komentar di migration.
- Backend menangani PostgreSQL `23505` dari index ini sebagai response `409`, bukan `500`.

### 12. Dokumentasi README dan PRD dirapikan

- README status diubah dari `Production Ready` menjadi `Hardening Beta`.
- Klaim absolut anti-fraud diturunkan menjadi klaim realistis.
- Klaim `85% threshold`, `PostGIS`, RAM processing server, Google Maps/Leaflet, dan export sekali klik disesuaikan.
- PRD disesuaikan dengan implementasi descriptor face matching.
- Endpoint yang belum ada seperti bulk import dan export dihapus dari daftar implemented API.
- Roadmap PRD diperbarui: fitur yang sudah ada ditandai selesai, fitur backlog tetap backlog.

### 13. HTTP security headers dan middleware

- Menambahkan dependency `helmet`.
- Menambahkan CSP, HSTS, `nosniff`, frame/object restrictions, referrer policy, dan header Helmet lain.
- Mematikan `X-Powered-By`.
- JSON body limit diturunkan dari `10mb` ke `1mb`, configurable via `JSON_BODY_LIMIT`.
- `urlencoded` limit menjadi `100kb`.
- Static asset cache policy:
  - HTML: `no-store`
  - asset lain: cache `1h` saat production
- Verifikasi `curl -I /api/health` menunjukkan security headers aktif.

### 14. Frontend security cleanup awal

- Menghapus file legacy tidak terpakai:
  - `admin/js/admin-auth.js`
  - `admin/js/mock-data.js`
  - `pegawai/js/auth.js`
  - `pegawai/js/mock-data.js`
- Menghapus Tailwind CDN dari admin pages karena UI sudah memakai `admin/css/admin.css`.
- CSP tidak lagi mengizinkan `unsafe-eval`.
- Search bersih dari `cdn.tailwindcss.com`, `unsafe-eval`, `admin123`, `password123`, dan mock JWT.

### 15. Migrasi inline JavaScript PWA tahap awal

- Memindahkan inline script `pegawai/login.html` ke `pegawai/js/login.js`.
- Memindahkan inline script dan handler reload `pegawai/offline.html` ke `pegawai/js/offline.js`.
- Menghapus `onclick` inline pada toggle "Ingat Saya" dan tombol "Coba Lagi".
- Memperbarui `pegawai/sw.js`:
  - cache version naik dari `absensi-kpi-v2` ke `absensi-kpi-v3`
  - `pegawai/js/login.js` dan `pegawai/js/offline.js` ikut dicache
- Dampak: dua halaman PWA pegawai sudah lebih siap menuju CSP tanpa inline script.

### 16. Migrasi inline JavaScript riwayat pegawai

- Memindahkan inline script `pegawai/riwayat.html` ke `pegawai/js/riwayat.js`.
- Menghapus `onclick` tombol navigasi bulan dan menggantinya dengan event listener.
- Menambahkan escaping HTML sederhana untuk nilai dinamis yang dirender dari data riwayat.
- Memperbarui `pegawai/sw.js`:
  - cache version naik dari `absensi-kpi-v3` ke `absensi-kpi-v4`
  - `pegawai/js/riwayat.js` ikut dicache
- Dampak: `pegawai/riwayat.html` sudah bersih dari inline script/handler dan sedikit lebih aman saat render data dari API.

### 17. Migrasi inline JavaScript profil pegawai

- Memindahkan inline script `pegawai/profil.html` ke `pegawai/js/profil.js`.
- Menghapus inline handler pada menu reset wajah, menu logout, tombol batal logout, dan tombol konfirmasi logout.
- Menambahkan event listener eksternal untuk aksi reset wajah dan modal logout.
- Menambahkan aktivasi keyboard pada item menu reset wajah/logout (`Enter` dan `Space`).
- Memperbarui `pegawai/sw.js`:
  - cache version naik dari `absensi-kpi-v4` ke `absensi-kpi-v5`
  - `pegawai/js/profil.js` ikut dicache
- Dampak: `pegawai/profil.html` sudah bersih dari inline script/handler dan interaksi menu sedikit lebih aksesibel.

### 18. Migrasi inline JavaScript dashboard pegawai

- Memindahkan inline script `pegawai/index.html` ke `pegawai/js/index.js`.
- Menghapus inline handler tombol clock-in dan clock-out, lalu menggantinya dengan event listener eksternal.
- Menambahkan escaping HTML sederhana untuk data dinamis pada riwayat terkini dan daftar hari libur.
- Mengubah pengecekan "hari ini" di dashboard agar memakai tanggal lokal browser, bukan `toISOString()` UTC.
- Menghapus fallback GPS dummy pada dashboard; jika GPS gagal, tombol absen tetap nonaktif.
- Menambahkan state gabungan GPS/status absensi agar tombol clock-in/clock-out tidak aktif dalam urutan yang salah.
- Memperbarui `pegawai/sw.js`:
  - cache version naik dari `absensi-kpi-v5` ke `absensi-kpi-v6`
  - `pegawai/js/index.js` ikut dicache
- Dampak: `pegawai/index.html` sudah bersih dari inline script/handler dan tombol absensi lebih konsisten dengan validasi GPS/status.

### 19. Migrasi inline JavaScript registrasi wajah

- Memindahkan inline script `pegawai/register-face.html` ke `pegawai/js/register-face.js`.
- Menghapus inline handler tombol buka kamera, tutup kamera, ambil foto, ulangi foto, konfirmasi, dan mulai absensi.
- Mempertahankan preload model face-api.js sambil tetap menunggu library CDN siap.
- Mengganti update session manual menjadi `API.updateSession(...)`.
- Menambahkan cleanup kamera saat halaman ditutup lewat `beforeunload`.
- Memperbarui `pegawai/sw.js`:
  - cache version naik dari `absensi-kpi-v6` ke `absensi-kpi-v7`
  - `pegawai/js/register-face.js` ikut dicache
- Dampak: `pegawai/register-face.html` sudah bersih dari inline script/handler tanpa mengubah alur registrasi wajah.

### 20. Migrasi inline JavaScript absensi pegawai

- Memindahkan inline script `pegawai/absen.html` ke `pegawai/js/absen.js`.
- Menghapus inline handler tombol kembali, capture, kembali ke beranda, dan coba lagi.
- Membatasi `type` query ke `masuk` atau `pulang`; nilai lain fallback ke `masuk`.
- Menambahkan guard agar tombol capture tidak memicu proses verifikasi ganda.
- Memastikan kamera dihentikan saat verifikasi gagal, kembali ke dashboard, atau halaman ditutup.
- Memperbarui `pegawai/sw.js`:
  - cache version naik dari `absensi-kpi-v7` ke `absensi-kpi-v8`
  - `pegawai/js/absen.js` ikut dicache
- Dampak: semua HTML di folder `pegawai/` sudah bersih dari inline script/handler.

### 21. Migrasi inline JavaScript login admin

- Memindahkan inline script `admin/login.html` ke `admin/js/login.js`.
- Menghapus inline auth guard dan submit handler dari HTML login admin.
- Login admin tetap memakai `AdminAPI.login(...)` dan toast dari `AdminApp`.
- Dampak: `admin/login.html` sudah bersih dari inline script/handler.

### 22. Bersihkan inline handler shared admin shell

- Menghapus inline `onclick` yang dihasilkan `admin/js/admin-app.js` untuk logout sidebar.
- Menghapus inline `onclick` yang dihasilkan `admin/js/admin-app.js` untuk tombol menu mobile.
- Menambahkan event delegation untuk `#adminLogoutLink` dan `#mobileMenuBtn`.
- Menambahkan `AdminApp.escapeHtml(...)` untuk teks dinamis pada shared topbar.
- Nama admin, inisial avatar, dan judul topbar sekarang di-escape sebelum masuk template HTML.
- Dampak: shared sidebar/topbar admin tidak lagi menghasilkan inline handler saat dirender di halaman admin.

### 23. Migrasi seluruh inline JavaScript halaman admin

- Memindahkan inline script `admin/index.html` ke `admin/js/dashboard.js`.
- Memindahkan inline script `admin/audit-log.html` ke `admin/js/audit-log.js`.
- Memindahkan inline script `admin/settings.html` ke `admin/js/settings.js`.
- Memindahkan inline script `admin/pegawai.html` ke `admin/js/pegawai.js`.
- Memindahkan inline script `admin/absensi.html` ke `admin/js/absensi.js`.
- Menghapus inline `onclick/onchange/oninput` dari halaman admin.
- Mengganti aksi dinamis tabel pegawai, tabel absensi, dan pagination menjadi event listener berbasis `data-*`.
- Menambahkan escaping HTML untuk data dinamis admin yang dirender ke tabel, timeline, map popup, dan template.
- Membersihkan inline handler yang digenerate `pegawai/js/app.js` pada banner install PWA.
- Dampak: folder `admin/` dan `pegawai/` sudah bersih dari inline script dan inline event handler.

### 24. CSP script diperketat

- `backend/server.js` tidak lagi mengizinkan `script-src 'unsafe-inline'`.
- `script-src-attr` diubah menjadi `'none'`.
- `style-src 'unsafe-inline'` masih dipertahankan karena banyak halaman masih memakai inline style attribute/block.
- Dampak: CSP JavaScript jauh lebih ketat; pekerjaan berikutnya tinggal inline style dan vendor CDN jika ingin CSP production-grade penuh.

### 25. Sinkron dependency root untuk Vercel

- Menambahkan `helmet` ke root `package.json` karena Vercel menjalankan `api/index.js` dari root dan file itu memuat `backend/server.js`.
- Membuat root `package-lock.json` dengan `npm install --package-lock-only`.
- Root dependency audit setelah lockfile dibuat: `0 vulnerabilities`.
- Dampak: deploy Vercel tidak gagal karena `Cannot find module 'helmet'`.

## Verifikasi Yang Sudah Dilakukan

- `node --check` untuk file backend yang diubah, termasuk:
  - `backend/server.js`
  - `backend/routes/auth.js`
  - `backend/middleware/auth.js`
  - `backend/routes/absensi.js`
  - `backend/routes/face.js`
  - `backend/routes/pegawai.js`
  - `backend/routes/settings.js`
  - `backend/utils/face-match.js`
  - `backend/utils/validation.js`
  - `backend/scripts/create-admin.js`
- `npm audit --omit=dev` di `backend/` hasilnya `0 vulnerabilities`.
- Smoke start backend dengan `npm start` berhasil.
- Header check `curl -I http://localhost:5000/api/health` berhasil dan menampilkan security headers.
- Search repo untuk klaim/kredensial lama:
  - `admin123`
  - `password123`
  - `mock-jwt`
  - `Production_Ready`
  - `85%`
  - `PostGIS`
  - `cdn.tailwindcss.com`
  - `unsafe-eval`
- `node --check` untuk file frontend baru:
  - `pegawai/js/login.js`
  - `pegawai/js/offline.js`
  - `pegawai/js/riwayat.js`
  - `pegawai/js/profil.js`
  - `pegawai/js/index.js`
  - `pegawai/js/register-face.js`
  - `pegawai/js/absen.js`
  - `admin/js/login.js`
  - `admin/js/admin-app.js`
  - `admin/js/dashboard.js`
  - `admin/js/audit-log.js`
  - `admin/js/settings.js`
  - `admin/js/pegawai.js`
  - `admin/js/absensi.js`
- Search `pegawai/login.html` dan `pegawai/offline.html` sudah bersih dari `onclick` dan inline `<script>`.
- Search `pegawai/riwayat.html` sudah bersih dari `onclick/onchange/oninput` dan inline `<script>`.
- Search `pegawai/profil.html` sudah bersih dari `onclick/onchange/oninput` dan inline `<script>`.
- Search `pegawai/index.html` sudah bersih dari `onclick/onchange/oninput` dan inline `<script>`.
- Search `pegawai/register-face.html` sudah bersih dari `onclick/onchange/oninput` dan inline `<script>`.
- Search seluruh HTML `pegawai/` sudah bersih dari `onclick/onchange/oninput` dan inline `<script>`.
- Search `admin/login.html` sudah bersih dari `onclick/onchange/oninput` dan inline `<script>`.
- Search `admin/js/admin-app.js` sudah bersih dari `onclick/onchange/oninput`.
- Search seluruh `admin/` dan `pegawai/` untuk `onclick/onchange/oninput` dan inline `<script>` sudah bersih.
- Search HTML admin/pegawai untuk `javascript:` sudah bersih.
- `find admin/js pegawai/js -name '*.js' -exec node --check {} \;` sukses.
- `node --check backend/server.js` sukses.
- Smoke start backend berhasil setelah dijalankan di luar sandbox karena sandbox menolak bind port `0.0.0.0:5000` dengan `EPERM`.
- Header check `curl -I http://localhost:5000/api/health` menunjukkan:
  - `script-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com`
  - `script-src-attr 'none'`
- `npm install --package-lock-only` di root berhasil dan audit root menunjukkan `0 vulnerabilities`.
- Test module load Vercel dengan env dummy berhasil:
  `VERCEL=1 SUPABASE_URL=... SUPABASE_SERVICE_KEY=... JWT_SECRET=... node -e "const app = require('./api'); console.log(typeof app);"`

## Belum Dikerjakan / Backlog Teknis

### Deployment dan database

- Jalankan `backend/database/migration.sql` di Supabase production/staging.
- Jika migration memberi notice duplikat absensi, jalankan query diagnostic di komentar migration, bersihkan data, lalu rerun migration.
- Jalankan bootstrap admin pertama:

```bash
cd backend
npm run create-admin -- --username admin --password "password-kuat-minimal-12" --name "Administrator"
```

- Isi environment production:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `ALLOWED_ORIGINS`
  - `JSON_BODY_LIMIT`

### Testing manual dan E2E

- Test login admin dan pegawai di browser.
- Test registrasi wajah di perangkat dengan kamera nyata.
- Test clock-in dan clock-out dengan GPS nyata.
- Test penolakan GPS mati/ditolak.
- Test penolakan luar radius.
- Test duplicate clock-in/out dengan double click atau request paralel.
- Test reset wajah admin.
- Test nonaktifkan pegawai dan pastikan token lama tidak bisa lanjut.
- Test Render/Vercel deployment path sesuai target deploy.

### Automated tests

- Belum ada unit test backend.
- Belum ada integration test endpoint Express.
- Belum ada E2E Playwright untuk flow login, register face, absensi, dashboard admin.
- Belum ada CI pipeline untuk `node --check`, audit, dan smoke test.

### CSP/frontend security lanjutan

- CSP script sudah tidak mengizinkan inline script/handler.
- Semua HTML pegawai sudah dimigrasikan ke JS eksternal untuk inline script/handler.
- Semua halaman admin sudah dimigrasikan ke JS eksternal untuk inline script/handler.
- Shared shell `admin/js/admin-app.js` sudah bersih dari inline handler.
- Lanjut audit inline style sebelum menghapus:
  - `style-src 'unsafe-inline'`
- Pertimbangkan nonce/hash CSP hanya jika nantinya benar-benar perlu inline script terbatas.

### Vendor CDN/frontend dependency

- Belum mem-vendor atau membundel CDN berikut:
  - Google Fonts
  - face-api.js
  - face-api model weights
  - Chart.js
  - Leaflet
  - xlsx
  - jsPDF
  - jsPDF autotable
- Setelah dependency divendor/bundled, CSP bisa jauh lebih ketat dan app tidak bergantung ke CDN saat runtime.

### Supabase/RLS/security posture

- RLS masih disabled di migration karena backend memakai service role.
- Perlu desain policy jika ingin mengaktifkan RLS.
- Pastikan service role key hanya ada di backend server, tidak pernah di frontend.
- Pertimbangkan rotated secret policy dan audit access ke Supabase.

### Production hardening tambahan

- Tambahkan request logging terstruktur.
- Tambahkan centralized error logging.
- Tambahkan healthcheck yang memeriksa koneksi Supabase, bukan hanya proses Express.
- Tambahkan graceful shutdown untuk SIGTERM di Render.
- Tambahkan backup/restore SOP untuk database.
- Tambahkan data retention/archive job untuk log lama.
- Tambahkan monitoring uptime dan alert.

### Anti-fraud yang belum bisa dijamin penuh

- Fake GPS tidak bisa dimatikan total hanya dari web app.
- Perlu strategi tambahan jika threat model tinggi:
  - device binding
  - audit anomali lokasi
  - toleransi akurasi GPS
  - review pola absen
  - challenge liveness lebih kuat
- Face liveness masih bergantung pada kamera live browser dan face descriptor, belum ada advanced anti-spoofing.

### Product backlog

- Export Excel/PDF yang benar-benar production-grade.
- Bulk import pegawai via CSV/Excel.
- Geospatial map view yang matang dan sesuai CSP tanpa CDN runtime.
- Super admin role.
- Multi-klinik/cabang.
- Notifikasi WhatsApp/Telegram untuk keterlambatan.
- Laporan bulanan otomatis via email.
- Dark mode PWA jika tetap diinginkan.

## File Penting Yang Ditambah

- `backend/utils/face-match.js`
- `backend/utils/validation.js`
- `backend/scripts/create-admin.js`
- `pegawai/js/login.js`
- `pegawai/js/offline.js`
- `pegawai/js/riwayat.js`
- `pegawai/js/profil.js`
- `pegawai/js/index.js`
- `pegawai/js/register-face.js`
- `pegawai/js/absen.js`
- `admin/js/login.js`
- `admin/js/admin-app.js`
- `admin/js/dashboard.js`
- `admin/js/audit-log.js`
- `admin/js/settings.js`
- `admin/js/pegawai.js`
- `admin/js/absensi.js`
- `package-lock.json`
- `progress.md`

## File Legacy Yang Dihapus

- `admin/js/admin-auth.js`
- `admin/js/mock-data.js`
- `pegawai/js/auth.js`
- `pegawai/js/mock-data.js`
