(() => {
    if (!AdminAPI.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('sidebarContainer').innerHTML = AdminApp.renderSidebar('audit-log');
    document.getElementById('topBarContainer').innerHTML = AdminApp.renderTopBar('Audit Log');

    const actionLabels = {
        CREATE_PEGAWAI: { label: 'Tambah Pegawai', class: 'admin-badge-success' },
        RESET_WAJAH: { label: 'Reset Wajah', class: 'admin-badge-warning' },
        UPDATE_SETTING: { label: 'Update Setting', class: 'admin-badge-info' },
        UPDATE_SHIFT: { label: 'Update Shift', class: 'admin-badge-info' },
        UPDATE_PEGAWAI: { label: 'Update Pegawai', class: 'admin-badge-info' },
        ACTIVATE_PEGAWAI: { label: 'Aktifkan', class: 'admin-badge-success' },
        DEACTIVATE_PEGAWAI: { label: 'Nonaktifkan', class: 'admin-badge-danger' }
    };

    let allLogs = [];

    async function loadLogs() {
        try {
            const result = await AdminAPI.getAuditLog();
            allLogs = result.data || [];
            renderLogs(allLogs);
        } catch (err) {
            console.error('Load audit log error:', err);
        }
    }

    function filterLogs() {
        const action = document.getElementById('actionFilter').value;
        const filtered = action ? allLogs.filter((log) => log.aksi === action) : allLogs;
        renderLogs(filtered);
    }

    function renderLogs(data) {
        document.getElementById('logCount').textContent = `${data.length} catatan`;
        const tbody = document.getElementById('auditLogBody');

        tbody.innerHTML = data.map((log) => {
            const action = actionLabels[log.aksi] || { label: log.aksi, class: 'admin-badge-default' };
            const detail = typeof log.detail === 'object' ? JSON.stringify(log.detail) : (log.detail || '-');
            return `
          <tr>
            <td style="white-space: nowrap; color: #64748B;">${AdminApp.escapeHtml(AdminApp.formatDateTime(log.created_at))}</td>
            <td style="font-weight: 600;">${AdminApp.escapeHtml(log.admin_name || '-')}</td>
            <td><span class="admin-badge ${action.class}">${AdminApp.escapeHtml(action.label)}</span></td>
            <td style="color: #334155; max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${AdminApp.escapeHtml(detail)}</td>
          </tr>
        `;
        }).join('');
    }

    document.getElementById('actionFilter')?.addEventListener('change', filterLogs);
    loadLogs();
})();
