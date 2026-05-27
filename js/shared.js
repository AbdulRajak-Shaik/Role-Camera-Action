const SHARED_API_BASE = '/api';

function getToken() {
  return localStorage.getItem('rca_token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('rca_user'));
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  if (token && user) {
    localStorage.setItem('rca_token', token);
    localStorage.setItem('rca_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('rca_token');
    localStorage.removeItem('rca_user');
  }
}

function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function api(path, options = {}) {
  const res = await fetch(`${SHARED_API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options.headers }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function requireAuth(redirect = '/') {
  if (!getToken()) {
    window.location.href = redirect;
    return false;
  }
  return true;
}

function toast(message, type = 'info') {
  let el = document.querySelector('.toast-notification');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-notification';
    document.body.appendChild(el);
  }
  el.className = `toast-notification ${type} show`;
  el.textContent = message;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}

function formatViews(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
}

function formatDate(d) {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (days < 1) return 'Today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

async function refreshUser() {
  const data = await api('/auth/me');
  setAuth(getToken(), data.user);
  return data.user;
}

function renderDashboardHeader(title, links = []) {
  const user = getUser();
  return `
    <header class="dash-header">
      <div class="dash-header-left">
        <a href="/" class="logo"><i class="fas fa-film"></i> RCA</a>
        <span class="dash-title">${title}</span>
      </div>
      <nav class="dash-nav">
        ${links.map(l => `<a href="${l.href}" class="${l.active ? 'active' : ''}">${l.label}</a>`).join('')}
        <a href="/">Home</a>
      </nav>
      <div class="dash-header-right">
        <div class="notif-bell-wrap" id="dashNotifBell"><button class="notif-bell-btn" type="button"><i class="fas fa-bell"></i></button></div>
        <span>${escapeHtml(user?.username || '')}</span>
        <button class="dash-btn secondary" id="dashLogout">Logout</button>
      </div>
    </header>`;
}

async function initDashNotifications(containerId = 'dashNotifBell') {
  const wrap = document.getElementById(containerId);
  if (!wrap || !getToken()) return;
  if (!wrap.querySelector('.notif-bell-btn')) {
    wrap.innerHTML = `<button type="button" class="notif-bell-btn"><i class="fas fa-bell"></i><span class="notif-badge" style="display:none">0</span></button>
      <div class="notif-panel"></div>`;
  }
  const badge = wrap.querySelector('.notif-badge');
  const panel = wrap.querySelector('.notif-panel');
  const btn = wrap.querySelector('.notif-bell-btn');
  if (btn._notifInit) return;
  btn._notifInit = true;

  async function loadCount() {
    try {
      const { count } = await api('/notifications/unread-count');
      if (count > 0) { badge.style.display = 'flex'; badge.textContent = count > 9 ? '9+' : count; }
      else badge.style.display = 'none';
    } catch (_) {}
  }

  async function loadPanel() {
    const { notifications } = await api('/notifications?limit=15');
    panel.innerHTML = notifications.length ? notifications.map(n => `
      <a class="notif-item ${n.read ? '' : 'unread'}" href="${n.actionUrl || '#'}" data-id="${n._id}">
        <strong>${escapeHtml(n.title)}</strong>
        <p>${escapeHtml(n.body)}</p>
        <small>${formatDate(n.createdAt)}</small>
      </a>`).join('') + `<button type="button" class="notif-mark-all">Mark all read</button>`
      : '<p class="notif-empty">No notifications</p>';
    panel.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        if (id) await api(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {});
      });
    });
    panel.querySelector('.notif-mark-all')?.addEventListener('click', async e => {
      e.preventDefault();
      await api('/notifications/read-all', { method: 'PATCH' });
      loadPanel();
      loadCount();
    });
  }

  btn.addEventListener('click', async () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) await loadPanel();
  });
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) panel.classList.remove('open');
  });
  await loadCount();
  setInterval(loadCount, 30000);
}
