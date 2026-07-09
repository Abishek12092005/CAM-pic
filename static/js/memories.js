let page = 1;
let hasMore = true;
let loading = false;

function renderCard(img) {
  const card = document.createElement('div');
  card.className = 'mem-card';
  card.innerHTML = `
    <img src="${img.image_path}" alt="memory" loading="lazy" />
    <div class="mem-meta">${new Date(img.captured_at).toLocaleString()}</div>
    <div class="mem-actions">
      <button class="action download" data-id="${img.id}">Download</button>
      <button class="action delete" data-id="${img.id}">Delete</button>
      <button class="action share" data-id="${img.id}">Share</button>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('action')) return;
    openFullScreen(img);
  });

  card.querySelector('.download')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    window.location.href = `/api/images/${img.id}/download`;
  });

  card.querySelector('.delete')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this memory?')) return;
    try {
      await apiFetch(`/api/images/${img.id}`, { method: 'DELETE' });
      card.remove();
      toast('Deleted', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  card.querySelector('.share')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const shareUrl = window.location.origin + img.image_path;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'CAM pics', text: 'My memory', url: shareUrl });
      } catch {}
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast('Link copied', 'success');
    }
  });

  return card;
}

function openFullScreen(img) {
  const modal = document.getElementById('viewer-modal');
  const modalImg = document.getElementById('viewer-img');
  modalImg.src = img.image_path;

  modal.classList.add('open');

  const close = modal.querySelector('.close');
  const onClose = () => modal.classList.remove('open');
  close.onclick = onClose;
  modal.querySelector('.viewer-download').onclick = () => {
    window.location.href = `/api/images/${img.id}/download`;
  };
}

async function loadMore() {
  if (loading || !hasMore) return;
  loading = true;

  const date_from = document.getElementById('date-from')?.value || '';
  const date_to = document.getElementById('date-to')?.value || '';

  try {
    const params = new URLSearchParams({ page: page, per_page: 12 });
    if (date_from) params.set('date_from', date_from);
    if (date_to) params.set('date_to', date_to);

    const data = await apiFetch(`/api/images?${params.toString()}`);
    const grid = document.getElementById('mem-grid');
    data.images.forEach(img => grid.appendChild(renderCard(img)));

    hasMore = !!data.has_more;
    page += 1;
  } catch (e) {
    toast(e.message, 'error');
    hasMore = false;
  } finally {
    loading = false;
  }
}

function resetAndLoad() {
  page = 1;
  hasMore = true;
  const grid = document.getElementById('mem-grid');
  grid.innerHTML = '';
  loadMore();
}

window.addEventListener('load', () => {
  loadMore();

  const sentinel = document.getElementById('scroll-sentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { threshold: 0.1 });
    obs.observe(sentinel);
  }

  document.getElementById('search-btn')?.addEventListener('click', resetAndLoad);
});

