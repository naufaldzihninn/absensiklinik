/* =====================================================
   Mock Data — Development Dummy Data
   ===================================================== */

const MOCK_EMPLOYEE = {
  id_pegawai: 'emp-001-uuid',
  username: 'budi.santoso',
  nama_lengkap: 'Budi Santoso',
  role: 'pegawai',
  foto_master_url: null,
  vektor_wajah: null, // Will be set after face registration
  status_wajah: true,
  is_active: true
};

const MOCK_CLINIC_SETTINGS = {
  nama_klinik: 'Klinik Prima Insani',
  titik_koordinat: '-6.200000, 106.816666', // Jakarta area
  latitude: -6.200000,
  longitude: 106.816666,
  batas_radius_meter: 50
};

const MOCK_SHIFTS = [
  {
    id_shift: 1,
    nama_shift: 'Pagi',
    batas_jam_mulai_scan: '04:00',
    batas_jam_akhir_scan: '11:59',
    jam_masuk_ideal: '07:00',
    jam_pulang_ideal: '14:00'
  },
  {
    id_shift: 2,
    nama_shift: 'Siang',
    batas_jam_mulai_scan: '12:00',
    batas_jam_akhir_scan: '20:00',
    jam_masuk_ideal: '14:00',
    jam_pulang_ideal: '21:00'
  }
];

// Generate 30 days of dummy attendance records
function generateAttendanceHistory() {
  const records = [];
  const today = new Date();
  const statuses = ['Tepat Waktu', 'Tepat Waktu', 'Tepat Waktu', 'Terlambat']; // 75% on-time

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const isToday = i === 0;
    const shift = MOCK_SHIFTS[0]; // Mostly morning shift
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const lateMinutes = status === 'Terlambat' ? Math.floor(Math.random() * 30) + 1 : 0;

    const clockInHour = 6 + Math.floor(Math.random() * 2); // 6-7
    const clockInMin = status === 'Terlambat' ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 55);

    const clockIn = {
      id_absen: `abs-${i}-in`,
      id_pegawai: MOCK_EMPLOYEE.id_pegawai,
      id_shift: shift.id_shift,
      nama_shift: shift.nama_shift,
      tipe_absen: 'MASUK',
      waktu_absen: new Date(date.getFullYear(), date.getMonth(), date.getDate(), clockInHour, clockInMin).toISOString(),
      koordinat_absen: '-6.200123, 106.816789',
      jarak_meter: Math.floor(Math.random() * 40) + 5,
      status_kehadiran: status,
      akurasi_wajah: (0.85 + Math.random() * 0.14).toFixed(3)
    };

    records.push(clockIn);

    // Add clock out (except for today if simulating)
    if (!isToday || Math.random() > 0.5) {
      const clockOutHour = 14 + Math.floor(Math.random() * 2);
      const clockOutMin = Math.floor(Math.random() * 55);

      const clockOut = {
        id_absen: `abs-${i}-out`,
        id_pegawai: MOCK_EMPLOYEE.id_pegawai,
        id_shift: shift.id_shift,
        nama_shift: shift.nama_shift,
        tipe_absen: 'PULANG',
        waktu_absen: new Date(date.getFullYear(), date.getMonth(), date.getDate(), clockOutHour, clockOutMin).toISOString(),
        koordinat_absen: '-6.200234, 106.816890',
        jarak_meter: Math.floor(Math.random() * 40) + 5,
        status_kehadiran: 'Tepat Waktu',
        akurasi_wajah: (0.85 + Math.random() * 0.14).toFixed(3)
      };

      records.push(clockOut);
    }
  }

  return records;
}

const MOCK_ATTENDANCE = generateAttendanceHistory();

// Compute monthly stats from attendance data
function getMonthlyStats(year, month) {
  const records = MOCK_ATTENDANCE.filter(r => {
    const d = new Date(r.waktu_absen);
    return d.getFullYear() === year && d.getMonth() === month && r.tipe_absen === 'MASUK';
  });

  const hadir = records.length;
  const telat = records.filter(r => r.status_kehadiran === 'Terlambat').length;

  // Count work days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d).getDay();
    if (day !== 0 && day !== 6) workDays++;
  }

  // Only count up to today
  const today = new Date();
  if (year === today.getFullYear() && month === today.getMonth()) {
    workDays = 0;
    for (let d = 1; d <= today.getDate(); d++) {
      const day = new Date(year, month, d).getDay();
      if (day !== 0 && day !== 6) workDays++;
    }
  }

  const alpa = Math.max(0, workDays - hadir);

  return { hadir, telat, alpa, workDays };
}

// Get today's attendance status
function getTodayStatus() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const todayRecords = MOCK_ATTENDANCE.filter(r => {
    return r.waktu_absen.startsWith(todayStr);
  });

  const clockIn = todayRecords.find(r => r.tipe_absen === 'MASUK');
  const clockOut = todayRecords.find(r => r.tipe_absen === 'PULANG');

  if (clockOut) return { status: 'complete', clockIn, clockOut };
  if (clockIn) return { status: 'clocked-in', clockIn };
  return { status: 'not-yet' };
}
