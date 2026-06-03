(() => {
    if (!API.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const MONTHS = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth();
    let allRecords = [];

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    function changeMonth(delta) {
        currentMonth += delta;

        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        } else if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }

        const now = new Date();
        const isFutureMonth = currentYear > now.getFullYear()
            || (currentYear === now.getFullYear() && currentMonth > now.getMonth());

        if (isFutureMonth) {
            currentMonth = now.getMonth();
            currentYear = now.getFullYear();
            return;
        }

        renderMonth();
    }

    async function loadAllHistory() {
        try {
            const result = await API.getHistory(365);
            allRecords = result.data || [];
            renderMonth();
        } catch (err) {
            console.error('Load history error:', err);
            allRecords = [];
            renderMonth();
        }
    }

    function renderMonth() {
        const monthLabel = document.getElementById('monthLabel');
        const statHadir = document.getElementById('statHadir');
        const statTelat = document.getElementById('statTelat');
        const statAlpa = document.getElementById('statAlpa');
        const container = document.getElementById('attendanceList');

        if (!monthLabel || !statHadir || !statTelat || !statAlpa || !container) return;

        monthLabel.textContent = `${MONTHS[currentMonth]} ${currentYear}`;

        const monthRecords = allRecords.filter((record) => {
            const date = new Date(record.waktu_absen);
            return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
        });

        const clockIns = monthRecords.filter((record) => record.tipe_absen === 'MASUK');
        statHadir.textContent = clockIns.length;
        statTelat.textContent = clockIns.filter((record) => record.status_kehadiran === 'Terlambat').length;
        statAlpa.textContent = 0;

        const groupedByDate = {};
        monthRecords.forEach((record) => {
            const dateKey = new Date(record.waktu_absen).toISOString().split('T')[0];
            if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
            groupedByDate[dateKey].push(record);
        });

        const sortedDates = Object.keys(groupedByDate).sort().reverse();

        if (sortedDates.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p class="empty-state-text">Tidak ada data absensi bulan ini</p></div>';
            return;
        }

        container.innerHTML = sortedDates.map((dateKey) => {
            const dayRecords = groupedByDate[dateKey];
            const clockIn = dayRecords.find((record) => record.tipe_absen === 'MASUK');
            const clockOut = dayRecords.find((record) => record.tipe_absen === 'PULANG');
            const dateDisplay = App.formatRecordDate(`${dateKey}T00:00:00`);
            const statusClass = clockIn && clockIn.status_kehadiran === 'Tepat Waktu' ? 'success' : 'warning';
            const statusText = clockIn ? clockIn.status_kehadiran : '-';
            const shiftName = clockIn ? (clockIn.nama_shift || '-') : '-';
            const faceAccuracy = clockIn ? `${((clockIn.akurasi_wajah || 0) * 100).toFixed(0)}%` : '-';

            return `
          <div class="glass-card-sm" style="margin-bottom: 10px;">
            <div class="flex items-center justify-between mb-sm">
              <span class="text-sm" style="font-weight: 600;">${escapeHtml(dateDisplay)}</span>
              <span class="badge badge-${statusClass}">${escapeHtml(statusText)}</span>
            </div>
            <div class="flex items-center justify-between" style="gap: 16px;">
              <div><div class="text-xs text-muted">Shift</div><div class="text-sm" style="font-weight: 500;">${escapeHtml(shiftName)}</div></div>
              <div style="text-align: center;"><div class="text-xs text-muted">Masuk</div><div class="text-sm" style="font-weight: 600; color: var(--success);">${clockIn ? App.formatTime(clockIn.waktu_absen) : '-'}</div></div>
              <div style="text-align: center;"><div class="text-xs text-muted">Pulang</div><div class="text-sm" style="font-weight: 600; color: var(--info);">${clockOut ? App.formatTime(clockOut.waktu_absen) : '-'}</div></div>
              <div style="text-align: right;"><div class="text-xs text-muted">AI</div><div class="text-sm" style="font-weight: 600;">${escapeHtml(faceAccuracy)}</div></div>
            </div>
          </div>
        `;
        }).join('');
    }

    document.getElementById('prevMonth')?.addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth')?.addEventListener('click', () => changeMonth(1));

    App.setActiveNav('riwayat');
    loadAllHistory();
})();
