/* =====================================================
   Admin App — Main Application Logic
   ===================================================== */

const AdminApp = (() => {
  /**
   * Show admin toast notification
   */
  function showToast(message, type = 'info') {
    let container = document.querySelector('.admin-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'admin-toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `admin-toast ${type}`;
    toast.innerHTML = `
      <span style="font-size: 1.1rem;">${icons[type] || 'ℹ'}</span>
      <span style="font-size: 0.875rem; font-weight: 500;">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('admin-toast-exit');
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  /**
   * Open a modal
   */
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
  }

  /**
   * Close a modal
   */
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  /**
   * Set active sidebar link
   */
  function setActiveSidebar(page) {
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });
  }

  /**
   * Toggle sidebar (mobile)
   */
  function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
  }

  /**
   * Format date to Indonesian locale
   */
  function formatDate(date) {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  /**
   * Format time
   */
  function formatTime(date) {
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Format datetime
   */
  function formatDateTime(date) {
    return `${formatDate(date)} ${formatTime(date)}`;
  }

  /**
   * Get initials from name
   */
  function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  /**
   * Generate sidebar HTML
   */
  function renderSidebar(activePage) {
    return `
      <div class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <img src="../shared/assets/logo.png" alt="Logo">
          <div>
            <div class="sidebar-brand-text">Klinik Prima Insani</div>
            <div class="sidebar-brand-sub">Admin Dashboard</div>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="sidebar-section-label">Menu Utama</div>
          <a href="index.html" class="sidebar-link ${activePage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
            <span class="link-icon">📊</span> Dashboard
          </a>
          <a href="pegawai.html" class="sidebar-link ${activePage === 'pegawai' ? 'active' : ''}" data-page="pegawai">
            <span class="link-icon">👥</span> Pegawai
          </a>
          <a href="absensi.html" class="sidebar-link ${activePage === 'absensi' ? 'active' : ''}" data-page="absensi">
            <span class="link-icon">📋</span> Absensi
          </a>
          <div class="sidebar-section-label" style="margin-top: 8px;">Pengaturan</div>
          <a href="settings.html" class="sidebar-link ${activePage === 'settings' ? 'active' : ''}" data-page="settings">
            <span class="link-icon">⚙️</span> Pengaturan Klinik
          </a>
          <a href="audit-log.html" class="sidebar-link ${activePage === 'audit-log' ? 'active' : ''}" data-page="audit-log">
            <span class="link-icon">📝</span> Audit Log
          </a>
        </nav>
        <div class="sidebar-footer">
          <a href="#" class="sidebar-link" onclick="AdminAPI.logout(); return false;" data-page="">
            <span class="link-icon">🚪</span> Logout
          </a>
        </div>
      </div>
    `;
  }

  /**
   * Generate top bar HTML
   */
  function renderTopBar(title) {
    const session = AdminAPI.getSession();
    const name = session ? session.nama_lengkap : 'Admin';
    const initials = getInitials(name);

    return `
      <div class="top-bar">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="AdminApp.toggleSidebar()" style="display: none; border: none; background: none; font-size: 1.3rem; cursor: pointer; color: #334155;" class="mobile-menu-btn">☰</button>
          <h1 class="top-bar-title">${title}</h1>
        </div>
        <div class="top-bar-right">
          <div class="top-bar-user">
            <span style="font-size: 0.85rem; color: #64748B; font-weight: 500;">${name}</span>
            <div class="top-bar-avatar">${initials}</div>
          </div>
        </div>
      </div>
    `;
  }

  return {
    showToast,
    openModal,
    closeModal,
    setActiveSidebar,
    toggleSidebar,
    formatDate,
    formatTime,
    formatDateTime,
    getInitials,
    renderSidebar,
    renderTopBar
  };
})();
