(() => {
    if (!API.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const session = API.getSession();
    if (session && !session.has_vektor) {
        window.location.href = 'register-face.html';
        return;
    }

    const attendanceState = {
        gpsInRange: false,
        hasClockIn: false,
        hasClockOut: false
    };

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function localDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function isSameLocalDate(value, target = new Date()) {
        const date = new Date(value);
        return date.getFullYear() === target.getFullYear()
            && date.getMonth() === target.getMonth()
            && date.getDate() === target.getDate();
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function setDisabled(id, disabled) {
        const element = document.getElementById(id);
        if (element) element.disabled = disabled;
    }

    function updateActionButtons() {
        const canClockIn = attendanceState.gpsInRange
            && !attendanceState.hasClockIn
            && !attendanceState.hasClockOut;
        const canClockOut = attendanceState.gpsInRange
            && attendanceState.hasClockIn
            && !attendanceState.hasClockOut;

        setDisabled('clockInBtn', !canClockIn);
        setDisabled('clockOutBtn', !canClockOut);
    }

    async function initDashboard() {
        setText('greetingText', `${App.getGreeting()} 👋`);
        setText('greetingName', session?.nama_lengkap || '...');

        App.initClock('liveClock', 'liveDate');
        checkGPS();
        await loadAttendanceData();
        loadHolidayInfo();
        App.setActiveNav('home');
    }

    async function loadHolidayInfo() {
        try {
            const todayCheck = await API.checkHoliday();
            if (todayCheck.isHoliday) {
                const holidayBanner = document.getElementById('holidayBanner');
                if (holidayBanner) holidayBanner.style.display = 'block';
                setText('holidayName', `🏖️ ${todayCheck.name}`);
            }

            const holidays = await API.getHolidays();
            const today = localDateKey();
            const upcoming = (holidays.data || [])
                .filter((holiday) => holiday.date >= today)
                .slice(0, 3);

            if (upcoming.length === 0) return;

            const upcomingHolidays = document.getElementById('upcomingHolidays');
            const holidayList = document.getElementById('holidayList');
            if (!upcomingHolidays || !holidayList) return;

            upcomingHolidays.style.display = 'block';
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

            holidayList.innerHTML = upcoming.map((holiday) => {
                const date = new Date(`${holiday.date}T00:00:00`);
                const dateStr = `${date.getDate()} ${months[date.getMonth()]}`;
                const isToday = holiday.date === today;
                const cardBg = isToday ? 'rgba(245,158,11,0.1)' : 'var(--bg-card)';
                const cardBorder = isToday ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)';

                return `
                            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:${cardBg};border-radius:10px;border:1px solid ${cardBorder}">
                                <div style="min-width:44px;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border-radius:8px">
                                    <span style="font-size:0.7rem;color:#94A3B8">${months[date.getMonth()]}</span>
                                    <span style="font-weight:700;font-size:0.95rem">${date.getDate()}</span>
                                </div>
                                <div style="flex:1">
                                    <div style="font-weight:600;font-size:0.8rem">${escapeHtml(holiday.name)}</div>
                                    <div style="font-size:0.7rem;color:#64748B">${isToday ? 'Hari ini' : dateStr}</div>
                                </div>
                            </div>`;
            }).join('');
        } catch (err) {
            console.warn('Holiday load:', err);
        }
    }

    async function checkGPS() {
        const gpsStatus = document.getElementById('gpsStatus');
        const gpsText = document.getElementById('gpsText');

        try {
            const settingsRes = await API.getSettings();
            const settings = settingsRes.data;

            const pos = await Geolocation.getCurrentPosition();
            const distance = Geolocation.haversineDistance(
                pos.latitude,
                pos.longitude,
                parseFloat(settings.latitude),
                parseFloat(settings.longitude)
            );
            const distM = Math.round(distance);

            window._currentGPS = { latitude: pos.latitude, longitude: pos.longitude };

            if (distM <= settings.batas_radius_meter) {
                if (gpsStatus) gpsStatus.className = 'gps-status in-range';
                if (gpsText) gpsText.textContent = `Dalam radius klinik (${distM}m)`;
                attendanceState.gpsInRange = true;
            } else {
                if (gpsStatus) gpsStatus.className = 'gps-status out-range';
                if (gpsText) gpsText.textContent = `Di luar radius (${distM}m / ${settings.batas_radius_meter}m)`;
                attendanceState.gpsInRange = false;
            }
        } catch (err) {
            if (gpsStatus) gpsStatus.className = 'gps-status out-range';
            if (gpsText) gpsText.textContent = 'GPS tidak tersedia';
            window._currentGPS = null;
            attendanceState.gpsInRange = false;
        }

        updateActionButtons();
    }

    async function loadAttendanceData() {
        try {
            const result = await API.getHistory(7);
            const records = result.data || [];
            const now = new Date();
            const todayRecords = records.filter((record) => isSameLocalDate(record.waktu_absen, now));
            const clockIn = todayRecords.find((record) => record.tipe_absen === 'MASUK');
            const clockOut = todayRecords.find((record) => record.tipe_absen === 'PULANG');

            updateTodayStatus(clockIn, clockOut);
            renderRecentHistory(records.slice(0, 6));
        } catch (err) {
            console.error('Load attendance error:', err);
            updateTodayStatus(null, null);
            renderRecentHistory([]);
        }
    }

    function updateTodayStatus(clockIn, clockOut) {
        const statusBadge = document.getElementById('statusBadge');
        const statusTitle = document.getElementById('statusTitle');
        const statusDetail = document.getElementById('statusDetail');

        if (!statusBadge || !statusTitle || !statusDetail) return;

        attendanceState.hasClockIn = Boolean(clockIn);
        attendanceState.hasClockOut = Boolean(clockOut);

        if (clockIn && clockOut) {
            statusBadge.className = 'badge badge-success';
            statusBadge.textContent = 'Selesai';
            statusTitle.textContent = 'Sudah Clock-out ✅';
            statusDetail.textContent = `Masuk: ${App.formatTime(clockIn.waktu_absen)} • Pulang: ${App.formatTime(clockOut.waktu_absen)}`;
        } else if (clockIn) {
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = clockIn.status_kehadiran;
            statusTitle.textContent = 'Sudah Clock-in 🕐';
            statusDetail.textContent = `Masuk: ${App.formatTime(clockIn.waktu_absen)} • Shift ${clockIn.nama_shift || '-'}`;
        } else {
            statusBadge.className = 'badge badge-info';
            statusBadge.textContent = 'Menunggu';
            statusTitle.textContent = 'Belum Absen';
            statusDetail.textContent = 'Silakan lakukan clock-in';
        }

        updateActionButtons();
    }

    function renderRecentHistory(records) {
        const container = document.getElementById('recentHistory');
        if (!container) return;

        if (records.length === 0) {
            container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <p class="empty-state-text">Belum ada riwayat absensi</p>
          </div>
        `;
            return;
        }

        container.innerHTML = records.map((record) => {
            const isMasuk = record.tipe_absen === 'MASUK';
            const statusClass = record.status_kehadiran === 'Tepat Waktu' ? 'success' : 'warning';
            const statusBadge = isMasuk
                ? `<div class="record-status"><span class="badge badge-${statusClass}">${escapeHtml(record.status_kehadiran)}</span></div>`
                : '';

            return `
          <div class="record-item">
            <div class="record-icon ${isMasuk ? 'masuk' : 'pulang'}">
              ${isMasuk ? '📥' : '📤'}
            </div>
            <div class="record-info">
              <div class="record-title">${isMasuk ? 'Clock In' : 'Clock Out'}</div>
              <div class="record-sub">${escapeHtml(App.formatRecordDate(record.waktu_absen))} • Shift ${escapeHtml(record.nama_shift || '-')}</div>
            </div>
            <div class="record-meta">
              <div class="record-time">${escapeHtml(App.formatTime(record.waktu_absen))}</div>
              ${statusBadge}
            </div>
          </div>
        `;
        }).join('');
    }

    document.getElementById('clockInBtn')?.addEventListener('click', () => {
        window.location.href = 'absen.html?type=masuk';
    });

    document.getElementById('clockOutBtn')?.addEventListener('click', () => {
        window.location.href = 'absen.html?type=pulang';
    });

    initDashboard();
})();
