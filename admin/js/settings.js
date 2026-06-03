(() => {
    if (!AdminAPI.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('sidebarContainer').innerHTML = AdminApp.renderSidebar('settings');
    document.getElementById('topBarContainer').innerHTML = AdminApp.renderTopBar('Pengaturan Klinik');

    let settingsMap = null;
    let settingsMarker = null;
    let settingsCircle = null;

    function getNumber(id, fallback) {
        const value = Number(document.getElementById(id)?.value);
        return Number.isFinite(value) ? value : fallback;
    }

    function updateMapPreview() {
        const lat = getNumber('latitude', -6.2);
        const lng = getNumber('longitude', 106.816666);
        const rad = parseInt(document.getElementById('radius')?.value, 10) || 50;

        document.getElementById('previewLat').textContent = lat;
        document.getElementById('previewLng').textContent = lng;
        document.getElementById('previewRadius').textContent = rad;

        if (settingsMap) {
            settingsMap.setView([lat, lng], 17);
            if (settingsMarker) settingsMarker.setLatLng([lat, lng]);
            if (settingsCircle) {
                settingsCircle.setLatLng([lat, lng]);
                settingsCircle.setRadius(rad);
            }
        }
    }

    function initSettingsMap(lat, lng, radius) {
        const container = document.getElementById('settingsMap');
        if (!container) return;

        if (settingsMap) {
            settingsMap.remove();
            settingsMap = null;
        }

        settingsMap = L.map(container).setView([lat, lng], 17);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(settingsMap);

        settingsMarker = L.marker([lat, lng], { draggable: true }).addTo(settingsMap)
            .bindPopup('Lokasi Klinik').openPopup();

        settingsCircle = L.circle([lat, lng], {
            radius,
            color: '#6366F1',
            fillColor: '#6366F1',
            fillOpacity: 0.15,
            weight: 2
        }).addTo(settingsMap);

        settingsMarker.on('dragend', (event) => {
            const pos = event.target.getLatLng();
            document.getElementById('latitude').value = pos.lat.toFixed(6);
            document.getElementById('longitude').value = pos.lng.toFixed(6);
            settingsCircle.setLatLng(pos);
            updateMapPreview();
        });

        settingsMap.on('click', (event) => {
            const pos = event.latlng;
            settingsMarker.setLatLng(pos);
            settingsCircle.setLatLng(pos);
            document.getElementById('latitude').value = pos.lat.toFixed(6);
            document.getElementById('longitude').value = pos.lng.toFixed(6);
            updateMapPreview();
        });

        setTimeout(() => settingsMap.invalidateSize(), 300);
    }

    async function loadSettings() {
        try {
            const settingsRes = await AdminAPI.getSettings();
            const settings = settingsRes.data || {};
            document.getElementById('clinicName').value = settings.nama_klinik || '';
            document.getElementById('latitude').value = settings.latitude || '';
            document.getElementById('longitude').value = settings.longitude || '';
            document.getElementById('radius').value = settings.batas_radius_meter || 50;
            document.getElementById('previewLat').textContent = settings.latitude || '-';
            document.getElementById('previewLng').textContent = settings.longitude || '-';
            document.getElementById('previewRadius').textContent = settings.batas_radius_meter || 50;
            initSettingsMap(settings.latitude || -6.2, settings.longitude || 106.816666, settings.batas_radius_meter || 50);
        } catch (err) {
            console.error(err);
            initSettingsMap(-6.2, 106.816666, 50);
        }

        try {
            const shiftsRes = await AdminAPI.getShifts();
            renderShifts(shiftsRes.data || []);
        } catch (err) {
            console.error(err);
        }
    }

    function renderShifts(shifts) {
        const container = document.getElementById('shiftList');
        container.innerHTML = shifts.map((shift, index) => {
            const id = Number(shift.id_shift);
            return `
        <div style="background: #F8FAFC; border-radius: 10px; padding: 16px; margin-bottom: ${index < shifts.length - 1 ? '12px' : '0'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="font-weight: 700; color: #0F172A;">Shift ${AdminApp.escapeHtml(shift.nama_shift)}</h4>
            <span class="admin-badge admin-badge-info">Shift ${id}</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">Scan Mulai</label>
              <input type="time" id="shift${id}_start" class="admin-form-input" value="${AdminApp.escapeHtml(shift.batas_jam_mulai_scan)}" style="font-size: 0.85rem;">
            </div>
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">Scan Akhir</label>
              <input type="time" id="shift${id}_end" class="admin-form-input" value="${AdminApp.escapeHtml(shift.batas_jam_akhir_scan)}" style="font-size: 0.85rem;">
            </div>
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">Jam Masuk Ideal</label>
              <input type="time" id="shift${id}_masuk" class="admin-form-input" value="${AdminApp.escapeHtml(shift.jam_masuk_ideal)}" style="font-size: 0.85rem;">
            </div>
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">Jam Pulang Ideal</label>
              <input type="time" id="shift${id}_pulang" class="admin-form-input" value="${AdminApp.escapeHtml(shift.jam_pulang_ideal)}" style="font-size: 0.85rem;">
            </div>
          </div>
          <button class="admin-btn admin-btn-primary admin-btn-sm save-shift-btn" data-shift-id="${id}" style="margin-top: 12px; width: 100%;">
            Simpan Shift ${AdminApp.escapeHtml(shift.nama_shift)}
          </button>
        </div>
      `;
        }).join('');
    }

    async function saveLocation() {
        try {
            await AdminAPI.updateSettings({
                nama_klinik: document.getElementById('clinicName').value,
                latitude: parseFloat(document.getElementById('latitude').value),
                longitude: parseFloat(document.getElementById('longitude').value),
                batas_radius_meter: parseInt(document.getElementById('radius').value, 10)
            });
            AdminApp.showToast('Pengaturan lokasi berhasil disimpan', 'success');
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
        }
    }

    async function saveShift(id) {
        try {
            await AdminAPI.updateShift(id, {
                batas_jam_mulai_scan: document.getElementById(`shift${id}_start`).value,
                batas_jam_akhir_scan: document.getElementById(`shift${id}_end`).value,
                jam_masuk_ideal: document.getElementById(`shift${id}_masuk`).value,
                jam_pulang_ideal: document.getElementById(`shift${id}_pulang`).value
            });
            AdminApp.showToast(`Konfigurasi Shift ${id} berhasil disimpan`, 'success');
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
        }
    }

    function warnDanger() {
        if (confirm('PERINGATAN: Tindakan ini akan menghapus seluruh data wajah pegawai. Lanjutkan?')) {
            AdminApp.showToast('Fitur ini sedang dalam pengembangan', 'info');
        }
    }

    ['latitude', 'longitude', 'radius'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', updateMapPreview);
    });

    document.getElementById('saveLocationBtn')?.addEventListener('click', saveLocation);
    document.getElementById('dangerResetBtn')?.addEventListener('click', warnDanger);
    document.getElementById('shiftList')?.addEventListener('click', (event) => {
        const button = event.target.closest('.save-shift-btn');
        if (!button) return;
        saveShift(button.dataset.shiftId);
    });

    loadSettings();
})();
