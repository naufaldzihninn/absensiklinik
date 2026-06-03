(() => {
    if (!AdminAPI.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('sidebarContainer').innerHTML = AdminApp.renderSidebar('pegawai');
    document.getElementById('topBarContainer').innerHTML = AdminApp.renderTopBar('Kelola Pegawai');

    let employees = [];
    let resetTargetId = null;
    let deleteTargetId = null;

    async function loadEmployees() {
        try {
            const result = await AdminAPI.getPegawai();
            employees = result.data || [];
            renderEmployeeTable(employees);
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
        }
    }

    function renderEmployeeTable(data) {
        const tbody = document.getElementById('employeeTableBody');
        document.getElementById('employeeCount').textContent = `${data.length} pegawai`;

        tbody.innerHTML = data.map((employee) => {
            const initials = AdminApp.escapeHtml(AdminApp.getInitials(employee.nama_lengkap));
            const name = AdminApp.escapeHtml(employee.nama_lengkap || '-');
            const username = AdminApp.escapeHtml(employee.username || '-');
            const faceStatusBadge = employee.status_wajah
                ? '<span class="admin-badge admin-badge-success">Terdaftar ✓</span>'
                : '<span class="admin-badge admin-badge-warning">Belum</span>';
            const activeBadge = employee.is_active
                ? '<span class="admin-badge admin-badge-success">Aktif</span>'
                : '<span class="admin-badge admin-badge-default">Nonaktif</span>';
            const resetButton = employee.status_wajah
                ? `<button class="admin-btn admin-btn-danger admin-btn-sm employee-action-btn" data-action="reset-face" data-id="${employee.id_pegawai}">🔄 Reset</button>`
                : '';

            return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #0D9488, #14B8A6); 
                  display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: 700;">
                  ${initials}
                </div>
                <span style="font-weight: 600;">${name}</span>
              </div>
            </td>
            <td style="color: #64748B;">${username}</td>
            <td>${faceStatusBadge}</td>
            <td>${activeBadge}</td>
            <td style="color: #64748B;">${AdminApp.escapeHtml(AdminApp.formatDate(employee.created_at))}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                ${resetButton}
                <button class="admin-btn admin-btn-outline admin-btn-sm employee-action-btn" data-action="toggle-active" data-id="${employee.id_pegawai}">${employee.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button class="admin-btn admin-btn-sm employee-action-btn" data-action="delete" data-id="${employee.id_pegawai}" style="background:#FEE2E2;color:#DC2626;border:1px solid #FECACA;">🗑️ Hapus</button>
              </div>
            </td>
          </tr>
        `;
        }).join('');
    }

    function filterEmployees() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const filtered = employees.filter((employee) =>
            (employee.nama_lengkap || '').toLowerCase().includes(query)
            || (employee.username || '').toLowerCase().includes(query)
        );
        renderEmployeeTable(filtered);
    }

    async function addEmployee() {
        const name = document.getElementById('newEmpName').value.trim();
        const username = document.getElementById('newEmpUsername').value.trim();
        const password = document.getElementById('newEmpPassword').value;

        if (!name || !username || !password) {
            AdminApp.showToast('Semua field wajib diisi', 'error');
            return;
        }

        try {
            await AdminAPI.createPegawai({ nama_lengkap: name, username, password });
            AdminApp.closeModal('addEmployeeModal');
            AdminApp.showToast(`Pegawai "${name}" berhasil ditambahkan`, 'success');
            document.getElementById('newEmpName').value = '';
            document.getElementById('newEmpUsername').value = '';
            document.getElementById('newEmpPassword').value = '';
            await loadEmployees();
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
        }
    }

    function openResetFace(id) {
        const employee = employees.find((item) => item.id_pegawai === id);
        if (!employee) return;

        resetTargetId = id;
        document.getElementById('resetFaceName').textContent = employee.nama_lengkap || '-';
        AdminApp.openModal('resetFaceModal');
    }

    async function confirmResetFace() {
        if (!resetTargetId) return;

        try {
            await AdminAPI.resetFace(resetTargetId);
            AdminApp.showToast('Wajah berhasil direset', 'success');
            AdminApp.closeModal('resetFaceModal');
            await loadEmployees();
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
        }
    }

    async function toggleActive(id) {
        const employee = employees.find((item) => item.id_pegawai === id);
        if (!employee) return;

        try {
            await AdminAPI.updatePegawai(id, { is_active: !employee.is_active });
            AdminApp.showToast(`Status "${employee.nama_lengkap}" diubah`, 'success');
            await loadEmployees();
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
        }
    }

    function openDeleteEmployee(id) {
        const employee = employees.find((item) => item.id_pegawai === id);
        if (!employee) return;

        deleteTargetId = id;
        document.getElementById('deleteEmpName').textContent = employee.nama_lengkap || '-';
        AdminApp.openModal('deleteEmployeeModal');
    }

    async function confirmDeleteEmployee() {
        if (!deleteTargetId) return;

        try {
            await AdminAPI.deletePegawaiPermanent(deleteTargetId);
            AdminApp.showToast('Pegawai berhasil dihapus permanen', 'success');
            AdminApp.closeModal('deleteEmployeeModal');
            await loadEmployees();
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
        }
    }

    document.getElementById('searchInput')?.addEventListener('input', filterEmployees);
    document.getElementById('importCsvBtn')?.addEventListener('click', () => {
        AdminApp.showToast('Fitur bulk import akan tersedia setelah backend siap', 'info');
    });
    document.getElementById('addEmployeeBtn')?.addEventListener('click', () => AdminApp.openModal('addEmployeeModal'));
    document.getElementById('saveEmployeeBtn')?.addEventListener('click', addEmployee);
    document.getElementById('confirmResetFaceBtn')?.addEventListener('click', confirmResetFace);
    document.getElementById('confirmDeleteEmployeeBtn')?.addEventListener('click', confirmDeleteEmployee);

    document.querySelectorAll('[data-close-modal]').forEach((button) => {
        button.addEventListener('click', () => AdminApp.closeModal(button.dataset.closeModal));
    });

    document.getElementById('employeeTableBody')?.addEventListener('click', (event) => {
        const button = event.target.closest('.employee-action-btn');
        if (!button) return;

        const id = button.dataset.id;
        if (button.dataset.action === 'reset-face') openResetFace(id);
        if (button.dataset.action === 'toggle-active') toggleActive(id);
        if (button.dataset.action === 'delete') openDeleteEmployee(id);
    });

    loadEmployees();
})();
