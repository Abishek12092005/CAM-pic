document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        await apiFetch('/api/profile', {
            method: 'POST',
            body: formData // apiFetch handles FormData correctly
        });
        toast('Profile updated successfully!', 'success');
        setTimeout(() => window.location.href = '/profile', 1000);
    } catch (err) {
        toast(err.message, 'error');
    }
});