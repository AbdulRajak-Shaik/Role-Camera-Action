let view = 'dashboard';

async function render() {
  const app = document.getElementById('app');
  const user = getUser();

  if (!getToken()) {
    app.innerHTML = `<div class="dash-login">
      <h1><i class="fas fa-shield-alt"></i> Platform Admin</h1>
      <p style="color:#a0a0a0;margin:16px 0">Sign in with a platform admin account.</p>
      <div class="dash-form">
        <div class="form-row"><label>Email</label><input type="email" id="loginEmail"></div>
        <div class="form-row"><label>Password</label><input type="password" id="loginPassword"></div>
        <button class="dash-btn" id="loginBtn" style="width:100%;margin-top:8px">Sign In</button>
        <p style="margin-top:12px;font-size:12px;color:#666">Set ADMIN_EMAIL in backend/.env to auto-promote on register.</p>
      </div>
    </div>`;
    document.getElementById('loginBtn').onclick = async () => {
      try {
        const data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('loginEmail').value,
            password: document.getElementById('loginPassword').value
          })
        });
        setAuth(data.token, data.user);
        if (data.user.platformRole !== 'platform_admin') {
          setAuth(null);
          toast('Not a platform admin', 'error');
          return;
        }
        render();
      } catch (e) { toast(e.message, 'error'); }
    };
    return;
  }

  if (user?.platformRole !== 'platform_admin') {
    app.innerHTML = `<div class="dash-login"><h2>Access Denied</h2><p>Platform admin role required.</p><a href="/">Go Home</a></div>`;
    return;
  }

  const links = [
    { href: '#dashboard', label: 'Dashboard', active: view === 'dashboard' },
    { href: '#users', label: 'Users', active: view === 'users' },
    { href: '#videos', label: 'Videos', active: view === 'videos' },
    { href: '#audit', label: 'Audit Log', active: view === 'audit' }
  ];

  app.innerHTML = renderDashboardHeader('Platform Admin', links) + `
    <div class="dash-layout">
      <aside class="dash-sidebar">
        <a href="#dashboard" class="${view==='dashboard'?'active':''}"><i class="fas fa-chart-line"></i> Dashboard</a>
        <a href="#users" class="${view==='users'?'active':''}"><i class="fas fa-users"></i> Users</a>
        <a href="#videos" class="${view==='videos'?'active':''}"><i class="fas fa-video"></i> Videos</a>
        <a href="#audit" class="${view==='audit'?'active':''}"><i class="fas fa-list"></i> Audit Log</a>
        <a href="/studio"><i class="fas fa-sliders-h"></i> Creator Studio</a>
      </aside>
      <main class="dash-main" id="mainContent">Loading...</main>
    </div>`;

  document.getElementById('dashLogout').onclick = () => { setAuth(null); location.href = '/'; };
  initDashNotifications();

  if (view === 'dashboard') await renderDashboard();
  else if (view === 'users') await renderUsers();
  else if (view === 'videos') await renderVideos();
  else if (view === 'audit') await renderAudit();
}

async function renderDashboard() {
  const { stats } = await api('/admin/stats');
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-cards">
      <div class="dash-card"><h3>${stats.users}</h3><p>Total Users</p></div>
      <div class="dash-card"><h3>${stats.videos}</h3><p>Total Videos</p></div>
      <div class="dash-card"><h3>${stats.publishedVideos}</h3><p>Published</p></div>
      <div class="dash-card"><h3>${formatViews(stats.totalViews)}</h3><p>Total Views</p></div>
    </div>
    <div class="dash-panel">
      <h2>Platform Announcement</h2>
      <div class="dash-form">
        <div class="form-row"><label>Title</label><input id="annTitle" placeholder="Announcement title"></div>
        <div class="form-row"><label>Message</label><textarea id="annBody" rows="3" style="max-width:100%"></textarea></div>
        <button class="dash-btn" id="sendAnn">Send to Admins</button>
      </div>
    </div>`;
  document.getElementById('sendAnn').onclick = async () => {
    await api('/admin/announce', { method: 'POST', body: JSON.stringify({
      title: document.getElementById('annTitle').value,
      body: document.getElementById('annBody').value
    })});
    toast('Announcement sent', 'success');
  };
}

async function renderUsers() {
  const { users } = await api('/admin/users');
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel">
      <h2>Users</h2>
      <table class="dash-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td>${escapeHtml(u.username)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${u.platformRole}</td>
        <td>${u.isBanned ? 'Banned' : 'Active'}</td>
        <td>
          <button class="dash-btn small secondary ban-btn" data-id="${u._id}" data-banned="${!u.isBanned}">${u.isBanned ? 'Unban' : 'Ban'}</button>
          ${u.platformRole !== 'platform_admin' ? `<button class="dash-btn small promote-btn" data-id="${u._id}">Make Admin</button>` : ''}
        </td>
      </tr>`).join('')}</tbody></table>
    </div>`;
  document.querySelectorAll('.ban-btn').forEach(btn => btn.onclick = async () => {
    await api(`/admin/users/${btn.dataset.id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: btn.dataset.banned === 'true' }) });
    toast('Updated', 'success');
    renderUsers();
  });
  document.querySelectorAll('.promote-btn').forEach(btn => btn.onclick = async () => {
    await api(`/admin/users/${btn.dataset.id}/platform-role`, { method: 'PATCH', body: JSON.stringify({ role: 'platform_admin' }) });
    toast('Promoted to platform admin', 'success');
    renderUsers();
  });
}

async function renderVideos() {
  const { videos } = await api('/admin/videos');
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>All Videos</h2>
    <table class="dash-table"><thead><tr><th>Title</th><th>Creator</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead>
    <tbody>${videos.map(v => `<tr>
      <td>${escapeHtml(v.title)}</td>
      <td>${escapeHtml(v.uploadedBy?.username||'')}</td>
      <td class="status-${v.status}">${v.status}</td>
      <td>${v.views}</td>
      <td>
        <button class="dash-btn small unpublish-btn" data-id="${v._id}" data-status="${v.status==='published'?'unpublished':'published'}">
          ${v.status==='published'?'Unpublish':'Publish'}
        </button>
      </td>
    </tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('.unpublish-btn').forEach(btn => btn.onclick = async () => {
    await api(`/admin/videos/${btn.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: btn.dataset.status }) });
    renderVideos();
  });
}

async function renderAudit() {
  const { logs } = await api('/admin/audit-logs');
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Audit Log</h2>
    <table class="dash-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th></tr></thead>
    <tbody>${logs.map(l => `<tr>
      <td>${formatDate(l.createdAt)}</td>
      <td>${escapeHtml(l.actorId?.username||'System')}</td>
      <td>${escapeHtml(l.action)}</td>
    </tr>`).join('')}</tbody></table></div>`;
}

window.addEventListener('hashchange', () => {
  view = location.hash.slice(1) || 'dashboard';
  render();
});

view = location.hash.slice(1) || 'dashboard';
render();
