(() => {
    if (!AdminAPI.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('sidebarContainer').innerHTML = AdminApp.renderSidebar('absensi');
    document.getElementById('topBarContainer').innerHTML = AdminApp.renderTopBar('Data Absensi');

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    document.getElementById('dateFrom').value = weekAgo.toISOString().split('T')[0];
    document.getElementById('dateTo').value = today.toISOString().split('T')[0];

    let currentPage = 1;
    const perPage = 20;
    let allRecords = [];
    let filteredRecords = [];
    let leafletMap = null;
    let clinicSettings = null;

    async function loadRecords() {
        try {
            const result = await AdminAPI.getHistory('days=365');
            allRecords = result.data || [];
            filterRecords();
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
        }
    }

    function filterRecords() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        const statusFilter = document.getElementById('statusFilter').value;

        filteredRecords = allRecords.filter((record) => {
            const matchName = !query || (record.nama_pegawai || '').toLowerCase().includes(query);
            const recordDate = record.waktu_absen.split('T')[0];
            const matchDateFrom = !dateFrom || recordDate >= dateFrom;
            const matchDateTo = !dateTo || recordDate <= dateTo;
            const matchStatus = !statusFilter || record.status_kehadiran === statusFilter;
            const isMasuk = record.tipe_absen === 'MASUK';
            return matchName && matchDateFrom && matchDateTo && (isMasuk || !statusFilter) && (matchStatus || !isMasuk);
        });

        currentPage = 1;
        renderTable();
    }

    function renderTable() {
        const start = (currentPage - 1) * perPage;
        const end = start + perPage;
        const pageRecords = filteredRecords.slice(start, end);

        document.getElementById('recordCount').textContent = `${filteredRecords.length} catatan`;
        document.getElementById('paginationInfo').textContent =
            `Menampilkan ${filteredRecords.length === 0 ? 0 : start + 1}-${Math.min(end, filteredRecords.length)} dari ${filteredRecords.length}`;

        const tbody = document.getElementById('attendanceTableBody');
        tbody.innerHTML = pageRecords.map((record, index) => {
            const isMasuk = record.tipe_absen === 'MASUK';
            const typeBadge = isMasuk
                ? '<span class="admin-badge admin-badge-success">MASUK</span>'
                : '<span class="admin-badge admin-badge-info">PULANG</span>';

            let statusBadge = '';
            if (isMasuk) {
                statusBadge = record.status_kehadiran === 'Tepat Waktu'
                    ? '<span class="admin-badge admin-badge-success">Tepat Waktu</span>'
                    : '<span class="admin-badge admin-badge-warning">Terlambat</span>';
            } else {
                statusBadge = '<span class="admin-badge admin-badge-default">-</span>';
            }

            return `
          <tr>
            <td style="font-weight: 600;">${AdminApp.escapeHtml(record.nama_pegawai || '-')}</td>
            <td>${AdminApp.escapeHtml(AdminApp.formatDate(record.waktu_absen))}</td>
            <td>${AdminApp.escapeHtml(record.nama_shift || '-')}</td>
            <td>${typeBadge}</td>
            <td style="font-weight: 600;">${AdminApp.escapeHtml(AdminApp.formatTime(record.waktu_absen))}</td>
            <td>${statusBadge}</td>
            <td style="font-weight: 600; color: #22C55E;">${((record.akurasi_wajah || 0) * 100).toFixed(1)}%</td>
            <td>${Number(record.jarak_meter || 0)}m</td>
            <td>
              <button class="admin-btn admin-btn-outline admin-btn-sm show-map-btn" data-record-index="${start + index}">
                🗺️ Peta
              </button>
            </td>
          </tr>
        `;
        }).join('');

        const totalPages = Math.ceil(filteredRecords.length / perPage);
        const buttons = document.getElementById('paginationButtons');
        let html = '';
        for (let page = 1; page <= Math.min(totalPages, 5); page++) {
            html += `<button class="pagination-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`;
        }
        buttons.innerHTML = html;
    }

    function goToPage(page) {
        currentPage = page;
        renderTable();
    }

    async function loadClinicSettings() {
        try {
            const res = await AdminAPI.getSettings();
            clinicSettings = res.data;
        } catch (err) {
            console.warn('Settings load:', err);
        }
    }

    function parseCoordinates(coords) {
        if (coords && coords.includes(',')) {
            const parts = coords.split(',').map((part) => parseFloat(part.trim()));
            if (!Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
                return { lat: parts[0], lng: parts[1] };
            }
        }
        return { lat: -6.2, lng: 106.816666 };
    }

    function showMap(record) {
        const coords = record.koordinat_absen || '';
        const distance = Number(record.jarak_meter || 0);
        const accuracy = Number(record.akurasi_wajah || 0);
        const name = record.nama_pegawai || '-';

        document.getElementById('mapModalTitle').textContent = `Lokasi Absensi - ${name}`;
        document.getElementById('mapCoords').textContent = coords || '-';
        document.getElementById('mapDistance').textContent = `${distance} meter`;
        document.getElementById('mapAccuracy').textContent = `${(accuracy * 100).toFixed(1)}%`;
        document.getElementById('mapTime').textContent = AdminApp.formatDateTime(record.waktu_absen);
        AdminApp.openModal('mapModal');

        setTimeout(() => {
            const container = document.getElementById('mapContainer');
            if (leafletMap) {
                leafletMap.remove();
                leafletMap = null;
            }

            const employeeCoords = parseCoordinates(coords);
            const clinicLat = clinicSettings?.latitude || -6.2;
            const clinicLng = clinicSettings?.longitude || 106.816666;
            const radius = clinicSettings?.batas_radius_meter || 50;

            leafletMap = L.map(container).setView([employeeCoords.lat, employeeCoords.lng], 17);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(leafletMap);

            L.marker([employeeCoords.lat, employeeCoords.lng]).addTo(leafletMap)
                .bindPopup(`<b>${AdminApp.escapeHtml(name)}</b><br>Jarak: ${distance}m`).openPopup();

            const clinicIcon = L.divIcon({
                html: '<div style="background:#DC2626;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7],
                className: ''
            });
            L.marker([clinicLat, clinicLng], { icon: clinicIcon }).addTo(leafletMap)
                .bindPopup(`<b>Klinik Prima Insani</b><br>Radius: ${radius}m`);

            L.circle([clinicLat, clinicLng], {
                radius,
                color: '#6366F1',
                fillColor: '#6366F1',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '5,5'
            }).addTo(leafletMap);

            const bounds = L.latLngBounds([[employeeCoords.lat, employeeCoords.lng], [clinicLat, clinicLng]]);
            leafletMap.fitBounds(bounds.pad(0.3));
        }, 150);
    }

    function exportData(type) {
        if (!filteredRecords || filteredRecords.length === 0) {
            AdminApp.showToast('Tidak ada data untuk diekspor', 'error');
            return;
        }

        const rows = filteredRecords.map((record) => ({
            Nama: record.nama_pegawai || '-',
            Tanggal: AdminApp.formatDate(record.waktu_absen),
            Shift: record.nama_shift || '-',
            Tipe: record.tipe_absen,
            Waktu: AdminApp.formatTime(record.waktu_absen),
            Status: record.tipe_absen === 'MASUK' ? (record.status_kehadiran || '-') : '-',
            'Akurasi Wajah': `${((record.akurasi_wajah || 0) * 100).toFixed(1)}%`,
            'Jarak (m)': record.jarak_meter || 0
        }));

        const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

        if (type === 'excel') {
            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [
                { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
                { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 }
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Absensi');
            XLSX.writeFile(wb, `Absensi_KlinikPrimaInsani_${dateStr}.xlsx`);
            AdminApp.showToast('File Excel berhasil diunduh!', 'success');
        }

        if (type === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4');

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('Laporan Absensi - Klinik Prima Insani', 14, 18);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(`Diekspor: ${dateStr} | Total: ${rows.length} record`, 14, 25);
            doc.setTextColor(0);

            doc.autoTable({
                startY: 30,
                head: [Object.keys(rows[0])],
                body: rows.map((row) => Object.values(row)),
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 45 },
                    4: { halign: 'center' },
                    6: { halign: 'center' },
                    7: { halign: 'center' }
                }
            });

            doc.save(`Absensi_KlinikPrimaInsani_${dateStr}.pdf`);
            AdminApp.showToast('File PDF berhasil diunduh!', 'success');
        }
    }

    document.getElementById('searchInput')?.addEventListener('input', filterRecords);
    document.getElementById('dateFrom')?.addEventListener('change', filterRecords);
    document.getElementById('dateTo')?.addEventListener('change', filterRecords);
    document.getElementById('statusFilter')?.addEventListener('change', filterRecords);
    document.getElementById('exportExcelBtn')?.addEventListener('click', () => exportData('excel'));
    document.getElementById('exportPdfBtn')?.addEventListener('click', () => exportData('pdf'));
    document.getElementById('closeMapModalBtn')?.addEventListener('click', () => AdminApp.closeModal('mapModal'));

    document.getElementById('attendanceTableBody')?.addEventListener('click', (event) => {
        const button = event.target.closest('.show-map-btn');
        if (!button) return;

        const record = filteredRecords[Number(button.dataset.recordIndex)];
        if (record) showMap(record);
    });

    document.getElementById('paginationButtons')?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-page]');
        if (!button) return;
        goToPage(Number(button.dataset.page));
    });

    loadClinicSettings();
    loadRecords();
})();
