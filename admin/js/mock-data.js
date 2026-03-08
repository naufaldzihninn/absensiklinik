/* =====================================================
   Admin Mock Data — Development Dummy Data
   ===================================================== */

const ADMIN_MOCK_EMPLOYEES = [
    { id_pegawai: 'emp-001', username: 'budi.santoso', nama_lengkap: 'Budi Santoso', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-01-15' },
    { id_pegawai: 'emp-002', username: 'siti.rahma', nama_lengkap: 'Siti Rahma', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-01-15' },
    { id_pegawai: 'emp-003', username: 'andi.pratama', nama_lengkap: 'Andi Pratama', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-01-20' },
    { id_pegawai: 'emp-004', username: 'dewi.lestari', nama_lengkap: 'Dewi Lestari', role: 'pegawai', status_wajah: false, is_active: true, foto_master_url: null, created_at: '2026-02-01' },
    { id_pegawai: 'emp-005', username: 'rudi.hermawan', nama_lengkap: 'Rudi Hermawan', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-02-01' },
    { id_pegawai: 'emp-006', username: 'maya.sari', nama_lengkap: 'Maya Sari', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-02-10' },
    { id_pegawai: 'emp-007', username: 'agus.setiawan', nama_lengkap: 'Agus Setiawan', role: 'pegawai', status_wajah: true, is_active: false, foto_master_url: null, created_at: '2026-01-15' },
    { id_pegawai: 'emp-008', username: 'lina.kusuma', nama_lengkap: 'Lina Kusuma', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-02-15' },
    { id_pegawai: 'emp-009', username: 'farhan.malik', nama_lengkap: 'Farhan Malik', role: 'pegawai', status_wajah: false, is_active: true, foto_master_url: null, created_at: '2026-03-01' },
    { id_pegawai: 'emp-010', username: 'nur.hidayah', nama_lengkap: 'Nur Hidayah', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-03-01' },
    { id_pegawai: 'emp-011', username: 'dimas.putra', nama_lengkap: 'Dimas Putra', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-03-05' },
    { id_pegawai: 'emp-012', username: 'ratna.wulan', nama_lengkap: 'Ratna Wulandari', role: 'pegawai', status_wajah: true, is_active: true, foto_master_url: null, created_at: '2026-03-05' },
];

// Generate attendance records for all employees
function generateAdminAttendance() {
    const records = [];
    const today = new Date();

    ADMIN_MOCK_EMPLOYEES.filter(e => e.is_active).forEach(emp => {
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            if (date.getDay() === 0 || date.getDay() === 6) continue;

            // Random absence (10% chance)
            if (Math.random() < 0.1 && i > 0) continue;

            const isLate = Math.random() < 0.25;
            const clockInHour = isLate ? 7 + Math.floor(Math.random() * 2) : 6;
            const clockInMin = isLate ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 55);
            const akurasi = (0.85 + Math.random() * 0.14).toFixed(3);

            records.push({
                id_absen: `abs-${emp.id_pegawai}-${i}-in`,
                id_pegawai: emp.id_pegawai,
                nama_pegawai: emp.nama_lengkap,
                id_shift: 1,
                nama_shift: 'Pagi',
                tipe_absen: 'MASUK',
                waktu_absen: new Date(date.getFullYear(), date.getMonth(), date.getDate(), clockInHour, clockInMin).toISOString(),
                koordinat_absen: `-6.${200 + Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 1000)}, 106.${816 + Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 1000)}`,
                jarak_meter: Math.floor(Math.random() * 40) + 5,
                status_kehadiran: isLate ? 'Terlambat' : 'Tepat Waktu',
                akurasi_wajah: parseFloat(akurasi)
            });

            // Clock out
            if (i > 0 || Math.random() > 0.4) {
                const clockOutHour = 14 + Math.floor(Math.random() * 2);
                const clockOutMin = Math.floor(Math.random() * 55);
                records.push({
                    id_absen: `abs-${emp.id_pegawai}-${i}-out`,
                    id_pegawai: emp.id_pegawai,
                    nama_pegawai: emp.nama_lengkap,
                    id_shift: 1,
                    nama_shift: 'Pagi',
                    tipe_absen: 'PULANG',
                    waktu_absen: new Date(date.getFullYear(), date.getMonth(), date.getDate(), clockOutHour, clockOutMin).toISOString(),
                    koordinat_absen: `-6.${200 + Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 1000)}, 106.${816 + Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 1000)}`,
                    jarak_meter: Math.floor(Math.random() * 40) + 5,
                    status_kehadiran: 'Tepat Waktu',
                    akurasi_wajah: parseFloat(akurasi)
                });
            }
        }
    });

    return records.sort((a, b) => new Date(b.waktu_absen) - new Date(a.waktu_absen));
}

const ADMIN_MOCK_ATTENDANCE = generateAdminAttendance();

function getTodayAdminStats() {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeEmployees = ADMIN_MOCK_EMPLOYEES.filter(e => e.is_active);
    const todayClockIns = ADMIN_MOCK_ATTENDANCE.filter(r =>
        r.waktu_absen.startsWith(todayStr) && r.tipe_absen === 'MASUK'
    );

    const hadir = todayClockIns.length;
    const telat = todayClockIns.filter(r => r.status_kehadiran === 'Terlambat').length;
    const alpa = activeEmployees.length - hadir;

    return {
        totalPegawai: activeEmployees.length,
        hadir,
        telat,
        alpa,
        tepatWaktu: hadir - telat
    };
}

// Audit log mock data
const ADMIN_MOCK_AUDIT_LOG = [
    { id_log: 'log-001', admin_name: 'Administrator', aksi: 'CREATE_PEGAWAI', detail: 'Menambahkan pegawai baru: Dimas Putra', created_at: '2026-03-05T09:15:00' },
    { id_log: 'log-002', admin_name: 'Administrator', aksi: 'CREATE_PEGAWAI', detail: 'Menambahkan pegawai baru: Ratna Wulandari', created_at: '2026-03-05T09:20:00' },
    { id_log: 'log-003', admin_name: 'Administrator', aksi: 'RESET_WAJAH', detail: 'Reset wajah pegawai: Dewi Lestari', created_at: '2026-03-04T14:30:00' },
    { id_log: 'log-004', admin_name: 'Administrator', aksi: 'UPDATE_SETTING', detail: 'Mengubah radius klinik dari 30m menjadi 50m', created_at: '2026-03-03T10:00:00' },
    { id_log: 'log-005', admin_name: 'Administrator', aksi: 'DEACTIVATE_PEGAWAI', detail: 'Menonaktifkan pegawai: Agus Setiawan', created_at: '2026-03-02T11:45:00' },
    { id_log: 'log-006', admin_name: 'Administrator', aksi: 'CREATE_PEGAWAI', detail: 'Menambahkan pegawai baru: Farhan Malik', created_at: '2026-03-01T08:30:00' },
    { id_log: 'log-007', admin_name: 'Administrator', aksi: 'CREATE_PEGAWAI', detail: 'Menambahkan pegawai baru: Nur Hidayah', created_at: '2026-03-01T08:35:00' },
    { id_log: 'log-008', admin_name: 'Administrator', aksi: 'UPDATE_SETTING', detail: 'Mengubah koordinat klinik', created_at: '2026-02-28T16:00:00' },
    { id_log: 'log-009', admin_name: 'Administrator', aksi: 'RESET_WAJAH', detail: 'Reset wajah pegawai: Budi Santoso', created_at: '2026-02-25T09:00:00' },
    { id_log: 'log-010', admin_name: 'Administrator', aksi: 'CREATE_PEGAWAI', detail: 'Menambahkan pegawai baru: Lina Kusuma', created_at: '2026-02-15T09:00:00' },
];

const ADMIN_MOCK_SETTINGS = {
    nama_klinik: 'Klinik Prima Insani',
    latitude: '-6.200000',
    longitude: '106.816666',
    batas_radius_meter: 50
};

const ADMIN_MOCK_SHIFTS = [
    { id_shift: 1, nama_shift: 'Pagi', batas_jam_mulai_scan: '04:00', batas_jam_akhir_scan: '11:59', jam_masuk_ideal: '07:00', jam_pulang_ideal: '14:00' },
    { id_shift: 2, nama_shift: 'Siang', batas_jam_mulai_scan: '12:00', batas_jam_akhir_scan: '20:00', jam_masuk_ideal: '14:00', jam_pulang_ideal: '21:00' }
];
