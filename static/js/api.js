async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Accept': 'application/json',
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
        },
        body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}