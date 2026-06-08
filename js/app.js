/**
 * app.js — UI logic for the Update Profile Photos page.
 * Imports from mockApi.js; swap that module to go live.
 */

import { getProfile, saveProfile } from './mockApi.js';

/* ─── Constants ──────────────────────────────────────────── */
const MAX_PHOTOS      = 6;
const MAX_FILE_BYTES  = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES   = ['image/jpeg', 'image/png', 'image/webp'];

const ZOOM_MIN  = 1;
const ZOOM_MAX  = 4;
const ZOOM_STEP = 0.5;

/* ─── DOM refs ───────────────────────────────────────────── */
const loadingState  = document.getElementById('loading-state');
const errorState    = document.getElementById('error-state');
const content       = document.getElementById('content');
const photoGrid     = document.getElementById('photo-grid');
const fileInput     = document.getElementById('file-input');
const saveBtn       = document.getElementById('save-btn');
const toast         = document.getElementById('toast');

const lightbox      = document.getElementById('lightbox');
const lbImg         = document.getElementById('lb-img');
const lbViewport    = document.getElementById('lb-viewport');
const lbZoomIn      = document.getElementById('lb-zoom-in');
const lbZoomOut     = document.getElementById('lb-zoom-out');
const lbZoomLevel   = document.getElementById('lb-zoom-level');
const lbClose       = document.getElementById('lb-close');

const profileName   = document.getElementById('profile-name');
const profileMeta   = document.getElementById('profile-meta');
const profileBio    = document.getElementById('profile-bio');
const profileAvatar = document.getElementById('profile-avatar');

/* ─── App state ──────────────────────────────────────────── */
let state = {
  userId: '',
  // Entries: { id, url, isPrimary, status: 'kept'|'new'|'removed', blob?: Blob, objectUrl?: string }
  photos: [],
};

// Active slot index being targeted by the file input
let pendingSlotIndex = null;

// Object URLs to revoke on cleanup
const objectUrlRegistry = new Set();

/* ─── Bootstrap ──────────────────────────────────────────── */
async function init() {
  showLoading();
  try {
    const profile = await getProfile();
    applyProfile(profile);
    renderAll();
    showContent();
  } catch (err) {
    console.error('[app] Failed to load profile:', err);
    showError();
  }
}

document.getElementById('retry-btn').addEventListener('click', init);
init();

/* ─── State helpers ──────────────────────────────────────── */
function applyProfile(profile) {
  state.userId = profile.userId;
  state.photos = profile.photos.map(p => ({
    id:        p.id,
    url:       p.url,
    isPrimary: p.isPrimary,
    status:    'kept',
    blob:      null,
    objectUrl: null,
  }));

  // Populate profile card
  profileName.textContent   = profile.name;
  profileMeta.textContent   = `${profile.age} · ${profile.location}`;
  profileBio.textContent    = profile.bio;

  // Primary photo or first photo as avatar
  const primary = state.photos.find(p => p.isPrimary) || state.photos[0];
  if (primary) profileAvatar.src = primary.objectUrl || primary.url;
}

function activePhotos() {
  return state.photos.filter(p => p.status !== 'removed');
}

/* ─── Render ─────────────────────────────────────────────── */
function renderAll() {
  photoGrid.innerHTML = '';

  const visible = activePhotos();

  // Fill occupied slots
  visible.forEach((photo, i) => {
    const slot = buildFilledSlot(photo, i);
    photoGrid.appendChild(slot);
  });

  // Fill empty slots up to MAX_PHOTOS
  const emptyCount = MAX_PHOTOS - visible.length;
  for (let i = 0; i < emptyCount; i++) {
    const slot = buildEmptySlot(visible.length + i);
    photoGrid.appendChild(slot);
  }
}

function buildFilledSlot(photo, visualIndex) {
  const slot = document.createElement('div');
  slot.className = 'photo-slot photo-slot--filled';
  slot.dataset.photoId = photo.id;

  if (photo.isPrimary) {
    const badge = document.createElement('span');
    badge.className = 'photo-slot__primary-badge';
    badge.textContent = 'Primary';
    slot.appendChild(badge);
  }

  if (photo.status === 'new') {
    const badge = document.createElement('span');
    badge.className = 'photo-slot__new-badge';
    badge.textContent = 'New';
    slot.appendChild(badge);
  }

  const img = document.createElement('img');
  img.className = 'photo-slot__img';
  img.src = photo.objectUrl || photo.url;
  img.alt = photo.isPrimary ? 'Primary photo' : `Photo ${visualIndex + 1}`;
  img.loading = 'lazy';
  img.tabIndex = 0;
  img.setAttribute('role', 'button');
  img.addEventListener('click', () => openLightbox(photo.objectUrl || photo.url, img));
  img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(photo.objectUrl || photo.url, img); } });
  slot.appendChild(img);

  const controls = document.createElement('div');
  controls.className = 'photo-slot__controls';
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Photo actions');

  if (!photo.isPrimary) {
    const starBtn = document.createElement('button');
    starBtn.className = 'photo-slot__btn';
    starBtn.setAttribute('aria-label', 'Set as primary photo');
    starBtn.title = 'Set as primary';
    starBtn.innerHTML = svgStar();
    starBtn.addEventListener('click', (e) => { e.stopPropagation(); setPrimary(photo.id); });
    controls.appendChild(starBtn);
  }

  const removeBtn = document.createElement('button');
  removeBtn.className = 'photo-slot__btn photo-slot__btn--remove';
  removeBtn.setAttribute('aria-label', 'Remove photo');
  removeBtn.title = 'Remove';
  removeBtn.innerHTML = svgTrash();
  removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removePhoto(photo.id); });
  controls.appendChild(removeBtn);

  slot.appendChild(controls);
  return slot;
}

function buildEmptySlot(absoluteIndex) {
  const slot = document.createElement('div');
  slot.className = 'photo-slot photo-slot--empty';
  slot.setAttribute('role', 'button');
  slot.setAttribute('tabindex', '0');
  slot.setAttribute('aria-label', 'Add a photo');

  const icon = document.createElement('div');
  icon.className = 'add-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = svgPlus();
  slot.appendChild(icon);

  const label = document.createElement('span');
  label.textContent = 'Add photo';
  slot.appendChild(label);

  // Error lives inside the slot so it's an absolute overlay — no grid layout impact
  const errorEl = document.createElement('p');
  errorEl.className = 'slot-error';
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');
  errorEl.id = `slot-error-${absoluteIndex}`;
  slot.dataset.errorId = errorEl.id;
  slot.appendChild(errorEl);

  const triggerUpload = () => {
    pendingSlotIndex = absoluteIndex;
    fileInput.dataset.errorId = errorEl.id;
    fileInput.click();
  };

  slot.addEventListener('click', triggerUpload);
  slot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerUpload(); } });

  return slot;
}

/* ─── Photo actions ──────────────────────────────────────── */
function setPrimary(id) {
  state.photos.forEach(p => { p.isPrimary = (p.id === id); });
  renderAll();
  // Update avatar
  const primary = state.photos.find(p => p.isPrimary);
  if (primary) profileAvatar.src = primary.objectUrl || primary.url;
}

function removePhoto(id) {
  const photo = state.photos.find(p => p.id === id);
  if (!photo) return;

  // If this was the primary, promote the next available
  const wasPrimary = photo.isPrimary;

  if (photo.status === 'new') {
    // New photos are just discarded; revoke object URL
    revokeObjectUrl(photo.objectUrl);
    state.photos = state.photos.filter(p => p.id !== id);
  } else {
    photo.status    = 'removed';
    photo.isPrimary = false;
  }

  if (wasPrimary) {
    const next = activePhotos()[0];
    if (next) next.isPrimary = true;
  }

  renderAll();
  const primary = state.photos.find(p => p.isPrimary);
  if (primary) profileAvatar.src = primary.objectUrl || primary.url;
}

/* ─── File upload ────────────────────────────────────────── */
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  const errorId = fileInput.dataset.errorId;
  const errorEl = errorId ? document.getElementById(errorId) : null;

  const validationError = validateFile(file);
  if (validationError) {
    showSlotError(errorEl, validationError);
    fileInput.value = '';
    return;
  }

  if (errorEl) hideSlotError(errorEl);

  const objectUrl = URL.createObjectURL(file);
  objectUrlRegistry.add(objectUrl);

  const newId = `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const isFirstPhoto = activePhotos().length === 0;

  state.photos.push({
    id:        newId,
    url:       '',
    isPrimary: isFirstPhoto,
    status:    'new',
    blob:      file,
    objectUrl,
  });

  fileInput.value = '';
  pendingSlotIndex = null;

  renderAll();
  if (isFirstPhoto) profileAvatar.src = objectUrl;
});

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Only JPEG, PNG, or WebP images are allowed.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return `File too large — maximum size is 5 MB.`;
  }
  return null;
}

function showSlotError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => hideSlotError(el), 5000);
}

function hideSlotError(el) {
  if (!el) return;
  el.classList.remove('visible');
}

/* ─── Save ───────────────────────────────────────────────── */
saveBtn.addEventListener('click', async () => {
  setSaving(true);
  try {
    const payload = buildPayload();
    await saveProfile(payload);

    // After successful save, mark all 'new' as 'kept' (they'd have real IDs from server in production)
    state.photos = state.photos.filter(p => p.status !== 'removed');
    state.photos.forEach(p => { if (p.status === 'new') p.status = 'kept'; });

    showToast('Profile updated!', 'success');
    renderAll();
  } catch (err) {
    console.error('[app] Save failed:', err);
    showToast('Save failed — please try again.', 'error');
  } finally {
    setSaving(false);
  }
});

function buildPayload() {
  return {
    userId: state.userId,
    photos: state.photos.map(p => ({
      id:        p.id,
      isPrimary: p.isPrimary,
      // In production, upload blob first, then send back the returned URL/ID.
      // Here we include the blob reference for the mock to log.
      data:      p.blob || p.url,
      status:    p.status,
    })),
  };
}

function setSaving(isSaving) {
  saveBtn.disabled = isSaving;
  const label  = saveBtn.querySelector('.btn__label');
  const spinner = saveBtn.querySelector('.btn__spinner');
  if (label)  label.textContent = isSaving ? 'Saving…' : 'Save changes';
  if (spinner) spinner.style.display = isSaving ? 'block' : 'none';
}

/* ─── Lightbox ───────────────────────────────────────────── */
let lbScale     = 1;
let lbPanX      = 0;
let lbPanY      = 0;
let isDragging  = false;
let dragStartX  = 0;
let dragStartY  = 0;
let panStartX   = 0;
let panStartY   = 0;

// Pinch-to-zoom state
let lastPinchDist = 0;

// The element that triggered the lightbox — focus is returned here on close
let lbOpener = null;

function openLightbox(url, triggerEl) {
  lbOpener = triggerEl || null;
  lbImg.src = url;
  lbScale = 1; lbPanX = 0; lbPanY = 0;
  applyTransform();
  lightbox.classList.add('open');
  document.body.classList.add('lightbox-open');
  lbClose.focus();
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.classList.remove('lightbox-open');
  lbImg.src = '';
  lbScale = 1; lbPanX = 0; lbPanY = 0;
  isDragging = false;
  if (lbOpener) { lbOpener.focus(); lbOpener = null; }
}

function applyTransform() {
  lbImg.style.transform = `scale(${lbScale}) translate(${lbPanX / lbScale}px, ${lbPanY / lbScale}px)`;
  lbZoomLevel.textContent = `${Math.round(lbScale * 100)}%`;
  lbZoomOut.disabled = lbScale <= ZOOM_MIN;
  lbZoomIn.disabled  = lbScale >= ZOOM_MAX;
}

function clampPan() {
  if (lbScale <= 1) { lbPanX = 0; lbPanY = 0; return; }
  const vw = lbViewport.clientWidth;
  const vh = lbViewport.clientHeight;
  const maxX = (vw  * (lbScale - 1)) / 2;
  const maxY = (vh * (lbScale - 1)) / 2;
  lbPanX = Math.max(-maxX, Math.min(maxX, lbPanX));
  lbPanY = Math.max(-maxY, Math.min(maxY, lbPanY));
}

lbZoomIn.addEventListener('click', () => {
  lbScale = Math.min(ZOOM_MAX, lbScale + ZOOM_STEP);
  clampPan(); applyTransform();
});

lbZoomOut.addEventListener('click', () => {
  lbScale = Math.max(ZOOM_MIN, lbScale - ZOOM_STEP);
  clampPan(); applyTransform();
});

lbClose.addEventListener('click', closeLightbox);

// Backdrop click
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

// Escape key + focus trap
lightbox.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeLightbox(); return; }

  // Focus trap: keep Tab within lightbox controls
  const focusable = [...lightbox.querySelectorAll('button:not(:disabled)')];
  if (e.key === 'Tab' && focusable.length) {
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }
});

/* Mouse drag-to-pan */
lbViewport.addEventListener('mousedown', e => {
  if (lbScale <= 1) return;
  isDragging = true;
  dragStartX = e.clientX; dragStartY = e.clientY;
  panStartX  = lbPanX;    panStartY  = lbPanY;
  lbViewport.classList.add('dragging');
});

window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  lbPanX = panStartX + (e.clientX - dragStartX);
  lbPanY = panStartY + (e.clientY - dragStartY);
  clampPan(); applyTransform();
});

window.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  lbViewport.classList.remove('dragging');
});

/* Touch events — drag-to-pan + pinch-to-zoom */
lbViewport.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    // Pinch start
    lastPinchDist = getPinchDist(e.touches);
  } else if (e.touches.length === 1 && lbScale > 1) {
    isDragging = true;
    dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY;
    panStartX  = lbPanX;               panStartY  = lbPanY;
  }
}, { passive: true });

lbViewport.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dist = getPinchDist(e.touches);
    const ratio = dist / lastPinchDist;
    lbScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, lbScale * ratio));
    lastPinchDist = dist;
    clampPan(); applyTransform();
  } else if (isDragging && e.touches.length === 1) {
    lbPanX = panStartX + (e.touches[0].clientX - dragStartX);
    lbPanY = panStartY + (e.touches[0].clientY - dragStartY);
    clampPan(); applyTransform();
  }
}, { passive: false });

lbViewport.addEventListener('touchend', () => { isDragging = false; }, { passive: true });

function getPinchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

/* ─── Toast ──────────────────────────────────────────────── */
let toastTimer = null;

function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className = `toast--${type}`;
  // Force reflow so transition plays even on rapid calls
  void toast.offsetWidth;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

/* ─── UI state helpers ───────────────────────────────────── */
function showLoading() {
  loadingState.style.display = 'flex';
  errorState.style.display   = 'none';
  content.style.display      = 'none';
}

function showError() {
  loadingState.style.display = 'none';
  errorState.style.display   = 'flex';
  content.style.display      = 'none';
}

function showContent() {
  loadingState.style.display = 'none';
  errorState.style.display   = 'none';
  content.style.display      = 'block';
}

/* ─── Object URL cleanup ─────────────────────────────────── */
function revokeObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
    objectUrlRegistry.delete(url);
  }
}

// Revoke all object URLs when the page unloads
window.addEventListener('pagehide', () => {
  objectUrlRegistry.forEach(url => URL.revokeObjectURL(url));
  objectUrlRegistry.clear();
});

/* ─── SVG helpers ────────────────────────────────────────── */
function svgPlus() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`;
}

function svgTrash() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>`;
}

function svgStar() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
    fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`;
}
