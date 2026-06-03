(() => {
    const reloadBtn = document.getElementById('reloadBtn');
    const netStatus = document.getElementById('netStatus');

    if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    window.addEventListener('online', () => {
        if (netStatus) {
            netStatus.className = 'status online';
            netStatus.innerHTML = '✓ Koneksi kembali! Memuat ulang...';
        }

        setTimeout(() => {
            window.location.reload();
        }, 1500);
    });
})();
