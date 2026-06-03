(() => {
    if (AdminAPI.isAuthenticated()) {
        window.location.href = 'index.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');

    if (!loginForm || !loginBtn) return;

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        loginBtn.disabled = true;
        loginBtn.textContent = 'Memproses...';

        try {
            await AdminAPI.login(username, password);
            window.location.href = 'index.html';
        } catch (err) {
            AdminApp.showToast(err.message, 'error');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Masuk';
        }
    });
})();
