let stream = null;
let facingMode = 'environment';
let countdownTimer = null;

const FILTER_MAP = {
  none: 'none',
  grayscale: 'grayscale(1)',
  sepia: 'sepia(1)',
  contrast: 'contrast(1.4) saturate(1.2)',
  invert: 'invert(1)',
  hue: 'hue-rotate(180deg)',
  vintage: 'sepia(0.5) hue-rotate(-30deg) saturate(1.2) contrast(0.8)',
  night: 'brightness(0.8) contrast(1.2) sepia(1) hue-rotate(100deg) saturate(5)'
};

async function startCamera() {
  const video = document.getElementById('video');

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  const constraints = {
    audio: false,
    video: {
      facingMode,
      // smaller capture to make the camera page lightweight
      width: { ideal: 480 },
      height: { ideal: 720 },
    }
  };

  stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  await video.play();
}

function switchCamera() {
  const btn = document.getElementById('switch-btn');
  const wrapper = document.querySelector('.video-wrap');
  
  if (btn) btn.classList.toggle('active');
  if (wrapper) {
    wrapper.classList.add('flipping');
    setTimeout(() => wrapper.classList.remove('flipping'), 500);
  }

  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera().catch(err => toast(err.message, 'error'));
}

function updateLiveFilter() {
  const video = document.getElementById('video');
  const selected = document.querySelector('input[name="filter"]:checked')?.value || 'none';
  if (video) video.style.filter = FILTER_MAP[selected] || 'none';
}

function applyQuickFilters(ctx, canvas, filter, video) {
  ctx.save();
  ctx.filter = filter;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

async function captureAndHandle() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('capture-canvas');
  const ctx = canvas.getContext('2d');

  const flash = document.getElementById('flash');
  flash.classList.remove('flash-anim');
  void flash.offsetWidth;
  flash.classList.add('flash-anim');

  const selectedFilter = document.querySelector('input[name="filter"]:checked')?.value || 'none';
  // Cap canvas size for performance + smaller uploads
  const rawW = video.videoWidth || 480;
  const rawH = video.videoHeight || 720;

  // keep it small for performance + smaller uploads
  const MAX_W = 480;
  const MAX_H = 720;

  // If captured image looks mismatched with on-screen preview, normalize orientation.
  // Most phones deliver portrait feed; keep portrait ratio.
  const scale = Math.min(MAX_W / rawW, MAX_H / rawH, 1);
  const outW = Math.max(1, Math.round(rawW * scale));
  const outH = Math.max(1, Math.round(rawH * scale));

  canvas.width = outW;
  canvas.height = outH;



  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (selectedFilter in FILTER_MAP) {
    if (FILTER_MAP[selectedFilter] === 'none') {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else {
      applyQuickFilters(ctx, canvas, FILTER_MAP[selectedFilter], video);
    }
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) {
    toast('Capture failed', 'error');
    return;
  }

  const dataUrl = await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  const previewArea = document.getElementById('preview-area');
  const preview = document.getElementById('preview');
  preview.src = dataUrl;
  if (previewArea) previewArea.classList.add('show');

  const fd = new FormData();
  fd.append('image', blob, `capture_${Date.now()}.jpg`);
  fd.append('image_name', `capture_${Date.now()}.jpg`);

  try {
    await apiFetch('/api/upload', { method: 'POST', body: fd });
    toast('Uploaded!', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

function startCountdown(seconds) {
  if (countdownTimer) clearInterval(countdownTimer);
  const label = document.getElementById('countdown');
  label.textContent = seconds;
  label.classList.add('show');

  let s = seconds;
  countdownTimer = setInterval(() => {
    s--;
    label.textContent = s;
    if (s <= 0) {
      clearInterval(countdownTimer);
      label.classList.remove('show');
      captureAndHandle();
    }
  }, 1000);
}

function onCaptureClick() {
  const timerSelect = document.getElementById('timer-select');
  const seconds = timerSelect ? parseInt(timerSelect.value, 10) : 0;
  if (seconds > 0) startCountdown(seconds);
  else captureAndHandle();
}

async function initCamera() {
  await startCamera();
}

window.addEventListener('load', () => {
  const captureBtn = document.getElementById('capture-btn');

  if (captureBtn) captureBtn.addEventListener('click', onCaptureClick);

  // Double-tap and Swipe to switch camera
  const videoEl = document.getElementById('video');
  let lastTap = 0;
  let touchStartX = 0;

  videoEl.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      switchCamera();
    }
    lastTap = now;
  }, { passive: false });

  videoEl.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    if (Math.abs(touchEndX - touchStartX) > 100) {
      switchCamera();
    }
  });

  videoEl.addEventListener('dblclick', switchCamera); // Double click to switch camera
  const filterInputs = document.querySelectorAll('input[name="filter"]');
  filterInputs.forEach(i => i.addEventListener('change', updateLiveFilter));

  initCamera().catch(err => toast(err.message, 'error'));
});
