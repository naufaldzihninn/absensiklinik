(() => {
    if (!AdminAPI.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('sidebarContainer').innerHTML = AdminApp.renderSidebar('dashboard');
    document.getElementById('topBarContainer').innerHTML = AdminApp.renderTopBar('Dashboard');

    async function loadDashboard() {
        try {
            const result = await AdminAPI.getTodayStats();
            const stats = result.stats || {};
            document.getElementById('statTotal').textContent = stats.totalPegawai || 0;
            document.getElementById('statHadir').textContent = stats.hadir || 0;
            document.getElementById('statTelat').textContent = stats.terlambat || 0;
            document.getElementById('statAlpa').textContent = stats.alpa || 0;

            Charts.renderAttendanceDonut('donutChart', {
                tepatWaktu: stats.tepat_waktu ?? 0,
                telat: stats.terlambat ?? 0,
                alpa: stats.alpa ?? 0
            });

            try {
                const trendResult = await AdminAPI.getWeeklyTrend();
                Charts.renderWeeklyBar('barChart', trendResult.data || []);
            } catch {
                Charts.renderWeeklyBar('barChart', []);
            }

            renderTimeline(result.data || []);
        } catch (err) {
            console.error('Dashboard load error:', err);
        }

        try {
            const holidayCheck = await AdminAPI.checkHoliday();
            if (holidayCheck.isHoliday) {
                const banner = document.getElementById('adminHolidayBanner');
                if (banner) banner.style.display = 'block';
                document.getElementById('adminHolidayName').textContent = holidayCheck.name;
            }

            const holidays = await AdminAPI.getHolidays();
            const today = new Date().toISOString().split('T')[0];
            const next = (holidays.data || []).find((holiday) => holiday.date > today);
            if (next) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                const date = new Date(`${next.date}T00:00:00`);
                document.getElementById('adminUpcomingList').textContent =
                    `Libur berikutnya: ${next.name} (${date.getDate()} ${months[date.getMonth()]})`;
            }
        } catch (err) {
            console.warn('Holiday:', err);
        }
    }

    function renderTimeline(records) {
        const container = document.getElementById('timeline');
        const recent = records.slice(0, 10);

        if (recent.length === 0) {
            container.innerHTML = '<p style="color: #94A3B8; font-size: 0.875rem;">Belum ada aktivitas hari ini</p>';
            return;
        }

        container.innerHTML = recent.map((record) => {
            const isMasuk = record.tipe_absen === 'MASUK';
            const dotColor = isMasuk ? (record.status_kehadiran === 'Terlambat' ? 'amber' : 'green') : 'blue';
            const label = isMasuk ? 'Clock In' : 'Clock Out';
            const statusText = isMasuk ? ` - ${record.status_kehadiran || '-'}` : '';

            return `
          <div class="timeline-item">
            <div class="timeline-dot ${dotColor}"></div>
            <div class="timeline-content">
              <strong>${AdminApp.escapeHtml(record.nama_pegawai || '-')}</strong> ${label}${AdminApp.escapeHtml(statusText)}
            </div>
            <div class="timeline-time">${AdminApp.escapeHtml(AdminApp.formatTime(record.waktu_absen))}</div>
          </div>
        `;
        }).join('');
    }

    loadDashboard();
})();
