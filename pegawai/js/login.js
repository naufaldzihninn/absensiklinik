(() => {
    if (API.isAuthenticated()) {
        const session = API.getSession();
        window.location.href = (session && session.has_vektor) ? 'index.html' : 'register-face.html';
        return;
    }

    const rememberToggle = document.getElementById('rememberToggle');
    const rememberMe = document.getElementById('rememberMe');
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    const loginSpinner = document.getElementById('loginSpinner');

    if (rememberToggle && rememberMe) {
        rememberToggle.addEventListener('click', (event) => {
            if (event.target === rememberMe) return;
            rememberMe.checked = !rememberMe.checked;
        });

        rememberMe.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    if (!loginForm || !loginBtn || !loginText || !loginSpinner || !rememberMe) return;

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            App.showToast('Silakan isi username dan password', 'warning');
            return;
        }

        loginBtn.disabled = true;
        loginText.textContent = 'Memproses...';
        loginSpinner.style.display = 'block';

        try {
            const result = await API.login(username, password, rememberMe.checked);
            App.showToast(`Selamat datang, ${result.user.nama_lengkap}!`, 'success');

            setTimeout(() => {
                if (result.user.has_vektor) {
                    window.location.href = 'index.html';
                } else {
                    window.location.href = 'register-face.html';
                }
            }, 800);
        } catch (err) {
            App.showToast(err.message, 'error');
            loginBtn.disabled = false;
            loginText.textContent = 'Masuk';
            loginSpinner.style.display = 'none';
        }
    });
})();
