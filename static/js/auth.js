async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) return;
    try {
        await apiFetch('/api/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (err) {
        if (typeof toast === 'function') toast(err.message, 'error');
        else alert(err.message);
    }
}