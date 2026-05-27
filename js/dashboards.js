/* Unified in-app dashboards: Studio, Moderation, Platform Admin */

const Dashboards = {
  app: null,
  subView: 'dashboard',
  channelId: null,
  access: null,

  async getChannelId() {
    const user = getUser() || await refreshUser();
    return user?._id || user?.channelId;
  },

  async loadAccess() {
    if (!getToken()) return null;
    try {
      this.access = await api('/auth/access');
    } catch {
      this.access = null;
    }
    return this.access;
  },

  requireSignIn(app) {
    if (getToken()) return true;
    showAuthRequired(`access ${app === 'studio' ? 'Creator Studio' : app === 'mod' ? 'Moderation' : 'Platform Admin'}`);
    return false;
  },

  async open(app, subView = 'dashboard') {
    if (!this.requireSignIn(app)) return;

    await this.loadAccess();
    this.app = app;
    this.subView = subView;
    this.channelId = await this.getChannelId();

    if (app === 'admin') {
      const user = getUser();
      if (user?.platformRole !== 'platform_admin') {
        showNotification('Platform admin access required', 'error');
        return;
      }
    }
    if (app === 'mod') {
      const canMod = this.access?.canAccessMod || this.access?.isPlatformAdmin;
      if (!canMod) {
        showNotification('Moderator permissions required. Ask your channel manager to invite you.', 'error');
        return;
      }
    }

    const homeView = document.getElementById('homeView');
    const dashboardView = document.getElementById('dashboardView');
    if (!homeView || !dashboardView) {
      console.error('Dashboard containers missing from index.html');
      return;
    }
    homeView.style.display = 'none';
    dashboardView.style.display = 'block';

    const titles = { studio: 'Creator Studio', mod: 'Moderation Console', admin: 'Platform Admin' };
    document.getElementById('dashViewTitle').textContent = titles[app];

    this.renderSidebar();
    await this.renderContent();

    if (typeof setAppView === 'function') setAppView(app);
    document.querySelectorAll('.nav-item[data-app]').forEach(el => {
      el.classList.toggle('active', el.dataset.app === app);
    });
    document.querySelectorAll('.nav-item[data-genre]').forEach(el => el.classList.remove('active'));
    history.replaceState(null, '', `#${app}/${subView}`);
  },

  close() {
    this.app = null;
    const homeView = document.getElementById('homeView');
    const dashboardView = document.getElementById('dashboardView');
    if (homeView) homeView.style.display = '';
    if (dashboardView) dashboardView.style.display = 'none';
    history.replaceState(null, '', '/');
    if (typeof setAppView === 'function') setAppView('home');
    document.querySelectorAll('.nav-item[data-app]').forEach(el => el.classList.remove('active'));
    if (typeof setActiveNav === 'function') setActiveNav('all');
    if (typeof loadVideos === 'function') loadVideos();
  },

  renderSidebar() {
    const sidebar = document.getElementById('dashSidebar');
    const v = this.subView;
    const cid = this.channelId;

    if (this.app === 'studio') {
      sidebar.innerHTML = `
        <a href="#" class="${v === 'dashboard' ? 'active' : ''}" data-sub="dashboard"><i class="fas fa-chart-line"></i> Analytics</a>
        <a href="#" class="${v === 'videos' ? 'active' : ''}" data-sub="videos"><i class="fas fa-video"></i> Videos & Shorts</a>
        <a href="#" class="${v === 'upload' ? 'active' : ''}" data-sub="upload"><i class="fas fa-upload"></i> Upload</a>
        <a href="#" class="${v === 'community' ? 'active' : ''}" data-sub="community"><i class="fas fa-users"></i> Community</a>
        <a href="#" class="${v === 'comments' ? 'active' : ''}" data-sub="comments"><i class="fas fa-comments"></i> Comments</a>
        <a href="#" class="${v === 'team' ? 'active' : ''}" data-sub="team"><i class="fas fa-user-friends"></i> Team</a>`;
    } else if (this.app === 'mod') {
      const isManaging = this.access?.isPlatformAdmin ||
        this.access?.memberships?.some(m => String(m.channelId) === String(cid) && m.role === 'managing_moderator') ||
        getUser()?.platformRole === 'platform_admin';
      sidebar.innerHTML = `
        <a href="#" class="${v === 'dashboard' ? 'active' : ''}" data-sub="dashboard"><i class="fas fa-home"></i> Overview</a>
        <a href="#" class="${v === 'comments' ? 'active' : ''}" data-sub="comments"><i class="fas fa-comments"></i> Comments</a>
        <a href="#" class="${v === 'live' ? 'active' : ''}" data-sub="live"><i class="fas fa-broadcast-tower"></i> Live Chat</a>
        <a href="#" class="${v === 'hidden' ? 'active' : ''}" data-sub="hidden"><i class="fas fa-user-slash"></i> Hidden Users</a>
        ${isManaging ? `
        <a href="#" class="${v === 'chat-settings' ? 'active' : ''}" data-sub="chat-settings"><i class="fas fa-cog"></i> Chat Settings</a>
        <a href="#" class="${v === 'blocked' ? 'active' : ''}" data-sub="blocked"><i class="fas fa-ban"></i> Blocked Words</a>
        <a href="#" class="${v === 'mod-roster' ? 'active' : ''}" data-sub="mod-roster"><i class="fas fa-user-shield"></i> Mod Roster</a>` : ''}`;
    } else if (this.app === 'admin') {
      sidebar.innerHTML = `
        <a href="#" class="${v === 'dashboard' ? 'active' : ''}" data-sub="dashboard"><i class="fas fa-chart-line"></i> Dashboard</a>
        <a href="#" class="${v === 'users' ? 'active' : ''}" data-sub="users"><i class="fas fa-users"></i> Users</a>
        <a href="#" class="${v === 'videos' ? 'active' : ''}" data-sub="videos"><i class="fas fa-video"></i> Videos</a>
        <a href="#" class="${v === 'audit' ? 'active' : ''}" data-sub="audit"><i class="fas fa-list"></i> Audit Log</a>`;
    }

    sidebar.querySelectorAll('[data-sub]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        this.subView = a.dataset.sub;
        history.replaceState(null, '', `#${this.app}/${this.subView}`);
        this.renderSidebar();
        this.renderContent();
      });
    });
  },

  async renderContent() {
    const el = document.getElementById('dashMainContent');
    el.innerHTML = '<p style="color:#a0a0a0">Loading...</p>';
    const cid = this.channelId;
    const v = this.subView;

    try {
      if (this.app === 'studio') {
        if (v === 'dashboard') await this.studioAnalytics(el, cid);
        else if (v === 'videos') await this.studioVideos(el, cid);
        else if (v === 'upload') await this.studioUpload(el, cid);
        else if (v === 'community') await this.studioCommunity(el, cid);
        else if (v === 'comments') await this.studioComments(el, cid);
        else if (v === 'team') await this.studioTeam(el, cid);
      } else if (this.app === 'mod') {
        if (v === 'dashboard') await this.modOverview(el, cid);
        else if (v === 'comments') await this.modComments(el, cid);
        else if (v === 'live') await this.modLive(el, cid);
        else if (v === 'hidden') await this.modHidden(el, cid);
        else if (v === 'chat-settings') await this.modChatSettings(el, cid);
        else if (v === 'blocked') await this.modBlocked(el, cid);
        else if (v === 'mod-roster') await this.modRoster(el, cid);
      } else if (this.app === 'admin') {
        if (v === 'dashboard') await this.adminDashboard(el);
        else if (v === 'users') await this.adminUsers(el);
        else if (v === 'videos') await this.adminVideos(el);
        else if (v === 'audit') await this.adminAudit(el);
      }
    } catch (err) {
      el.innerHTML = `<div class="dash-panel"><p style="color:#e50914">${escapeHtml(err.message)}</p></div>`;
    }
  },

  parseHash() {
    const hash = location.hash.slice(1);
    if (!hash) return null;
    const [app, sub] = hash.split('/');
    if (['studio', 'mod', 'admin'].includes(app)) {
      return { app, sub: sub || 'dashboard' };
    }
    return null;
  },

  // --- Studio ---
  async studioAnalytics(el, cid) {
    const { analytics } = await api(`/studio/${cid}/analytics`);
    el.innerHTML = `
      <div class="dash-cards">
        <div class="dash-card"><h3>${formatViews(analytics.totalViews)}</h3><p>Total Views</p></div>
        <div class="dash-card"><h3>${analytics.totalLikes}</h3><p>Total Likes</p></div>
        <div class="dash-card"><h3>${analytics.videoCount}</h3><p>Videos</p></div>
        <div class="dash-card"><h3>${formatViews(analytics.subscribers)}</h3><p>Subscribers</p></div>
      </div>
      <div class="dash-panel"><h2>Top Videos</h2>
      <table class="dash-table"><thead><tr><th>Title</th><th>Views</th><th>Likes</th></tr></thead>
      <tbody>${(analytics.topVideos || []).map(v => `<tr><td>${escapeHtml(v.title)}</td><td>${v.views}</td><td>${v.likes}</td></tr>`).join('')}</tbody></table></div>`;
  },

  async studioVideos(el, cid) {
    const { videos } = await api(`/studio/${cid}/videos`);
    el.innerHTML = `<div class="dash-panel"><h2>Your Videos</h2>
      <table class="dash-table"><thead><tr><th>Title</th><th>Genre</th><th>Status</th><th>Short</th><th>Actions</th></tr></thead>
      <tbody>${videos.map(v => `<tr>
        <td>${escapeHtml(v.title)}</td><td>${v.genre}</td>
        <td class="status-${v.status}">${v.status}</td><td>${v.isShort ? 'Yes' : 'No'}</td>
        <td>
          ${v.status !== 'published' ? `<button class="dash-btn small pub-btn" data-id="${v._id}">Publish</button>` : ''}
          ${v.status === 'published' ? `<button class="dash-btn small secondary unpub-btn" data-id="${v._id}">Unpublish</button>` : ''}
          <button class="dash-btn small danger del-btn" data-id="${v._id}">Delete</button>
        </td></tr>`).join('')}</tbody></table></div>`;
    el.querySelectorAll('.pub-btn').forEach(b => b.onclick = async () => {
      await api(`/studio/${cid}/videos/${b.dataset.id}/publish`, { method: 'POST' });
      toast('Published! Subscribers notified.', 'success');
      this.studioVideos(el, cid);
    });
    el.querySelectorAll('.unpub-btn').forEach(b => b.onclick = async () => {
      await api(`/studio/${cid}/videos/${b.dataset.id}/unpublish`, { method: 'POST' });
      this.studioVideos(el, cid);
    });
    el.querySelectorAll('.del-btn').forEach(b => b.onclick = async () => {
      if (confirm('Delete this video?')) {
        await api(`/studio/${cid}/videos/${b.dataset.id}`, { method: 'DELETE' });
        this.studioVideos(el, cid);
      }
    });
  },

  async studioUpload(el, cid) {
    el.innerHTML = `<div class="dash-panel"><h2>Upload Video / Short</h2>
      <form id="studioUploadForm" class="dash-form">
        <div class="form-row"><label>Video file</label><input type="file" id="vf" accept="video/*" required></div>
        <div class="form-row"><label>Title</label><input id="vt" required></div>
        <div class="form-row"><label>Description</label><textarea id="vd" rows="3" style="max-width:100%"></textarea></div>
        <div class="form-row"><label>Genre</label>
          <select id="vg"><option value="drama">Drama</option><option value="comedy">Comedy</option><option value="action">Action</option>
          <option value="romance">Romance</option><option value="horror">Horror</option><option value="documentary">Documentary</option><option value="auditions">Auditions</option></select></div>
        <div class="form-row"><label><input type="checkbox" id="vs"> Short</label></div>
        <div class="form-row"><label>Status</label><select id="vst"><option value="draft">Draft</option><option value="published">Publish immediately</option></select></div>
        <button type="submit" class="dash-btn">Upload</button>
      </form></div>`;
    el.querySelector('#studioUploadForm').onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData();
      fd.append('video', el.querySelector('#vf').files[0]);
      fd.append('title', el.querySelector('#vt').value);
      fd.append('description', el.querySelector('#vd').value);
      fd.append('genre', el.querySelector('#vg').value);
      fd.append('isShort', el.querySelector('#vs').checked);
      fd.append('status', el.querySelector('#vst').value);
      const res = await fetch(`/api/studio/${cid}/videos`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const data = await res.json();
      if (data.success) {
        if (el.querySelector('#vst').value === 'published') {
          await api(`/studio/${cid}/videos/${data.video._id}/publish`, { method: 'POST' });
        }
        toast('Uploaded!', 'success');
        this.subView = 'videos';
        this.renderSidebar();
        this.renderContent();
      } else toast(data.error || 'Upload failed', 'error');
    };
  },

  async studioCommunity(el, cid) {
    const { posts } = await api(`/studio/${cid}/community`);
    el.innerHTML = `<div class="dash-panel"><h2>Community Posts</h2>
      <form id="postForm" class="dash-form" style="margin-bottom:20px">
        <div class="form-row"><textarea id="postContent" rows="3" placeholder="Share an update..." style="max-width:100%"></textarea></div>
        <button class="dash-btn" type="submit">Post</button>
      </form>
      ${posts.map(p => `<div style="padding:12px;border-bottom:1px solid #2a2a2a"><p>${escapeHtml(p.content)}</p><small>${formatDate(p.createdAt)}</small>
        <button class="dash-btn small danger del-post" data-id="${p._id}">Delete</button></div>`).join('') || '<p>No posts yet</p>'}</div>`;
    el.querySelector('#postForm').onsubmit = async e => {
      e.preventDefault();
      await api(`/studio/${cid}/community`, { method: 'POST', body: JSON.stringify({ content: el.querySelector('#postContent').value }) });
      toast('Posted!', 'success');
      this.studioCommunity(el, cid);
    };
    el.querySelectorAll('.del-post').forEach(b => b.onclick = async () => {
      await api(`/studio/${cid}/community/${b.dataset.id}`, { method: 'DELETE' });
      this.studioCommunity(el, cid);
    });
  },

  async studioComments(el, cid) {
    const { comments } = await api(`/studio/${cid}/comments`);
    el.innerHTML = `<div class="dash-panel"><h2>Comments Inbox</h2>
      <table class="dash-table"><thead><tr><th>Video</th><th>User</th><th>Comment</th><th>Actions</th></tr></thead>
      <tbody>${comments.map(c => `<tr>
        <td>${escapeHtml(c.videoId?.title || '')}</td><td>${escapeHtml(c.authorId?.username || '')}</td>
        <td>${escapeHtml(c.text)}</td>
        <td><button class="dash-btn small danger del-c" data-id="${c._id}">Remove</button>
        <button class="dash-btn small secondary pin-c" data-id="${c._id}">Pin</button></td>
      </tr>`).join('')}</tbody></table></div>`;
    el.querySelectorAll('.del-c').forEach(b => b.onclick = async () => {
      await api(`/comments/${b.dataset.id}`, { method: 'DELETE' });
      this.studioComments(el, cid);
    });
    el.querySelectorAll('.pin-c').forEach(b => b.onclick = async () => {
      await api(`/comments/${b.dataset.id}/pin`, { method: 'PUT' });
      toast('Pinned', 'success');
    });
  },

  async studioTeam(el, cid) {
    const { members } = await api(`/studio/${cid}/team`);
    el.innerHTML = `<div class="dash-panel"><h2>Team Members</h2>
      <form id="inviteForm" class="dash-form" style="margin-bottom:20px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div class="form-row" style="margin:0"><label>Email</label><input type="email" id="invEmail"></div>
        <div class="form-row" style="margin:0"><label>Role</label>
          <select id="invRole"><option value="manager">Manager</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
          <option value="managing_moderator">Managing Moderator</option><option value="standard_moderator">Standard Moderator</option></select></div>
        <button class="dash-btn" type="submit">Invite</button>
      </form>
      <table class="dash-table"><thead><tr><th>User</th><th>Role</th><th>Actions</th></tr></thead>
      <tbody>${members.map(m => `<tr>
        <td>${escapeHtml(m.userId?.username || m.userId?.email || '')}</td><td>${m.role}</td>
        <td><button class="dash-btn small danger rm-m" data-uid="${m.userId?._id}">Remove</button></td>
      </tr>`).join('')}</tbody></table></div>`;
    el.querySelector('#inviteForm').onsubmit = async e => {
      e.preventDefault();
      await api(`/studio/${cid}/team/invite`, { method: 'POST', body: JSON.stringify({
        email: el.querySelector('#invEmail').value, role: el.querySelector('#invRole').value
      })});
      toast('Invited!', 'success');
      this.studioTeam(el, cid);
    };
    el.querySelectorAll('.rm-m').forEach(b => b.onclick = async () => {
      await api(`/studio/${cid}/team/${b.dataset.uid}`, { method: 'DELETE' });
      this.studioTeam(el, cid);
    });
  },

  // --- Mod ---
  async modOverview(el, cid) {
    const data = await api(`/mod/${cid}/dashboard`);
    el.innerHTML = `
      <div class="dash-cards">
        <div class="dash-card"><h3>${data.activeStream ? 'LIVE' : '—'}</h3><p>Stream Status</p></div>
        <div class="dash-card"><h3>${data.recentComments?.length || 0}</h3><p>Recent Comments</p></div>
      </div>
      ${!data.activeStream ? `<button class="dash-btn" id="startLive">Start Live Stream</button>` :
        `<button class="dash-btn danger" id="endLive" data-id="${data.activeStream._id}">End Stream</button>`}
      <div class="dash-panel" style="margin-top:20px"><h2>Recent Comments</h2>
      ${(data.recentComments || []).map(c => `<div style="padding:8px;border-bottom:1px solid #2a2a2a">
        <b>${escapeHtml(c.authorId?.username || '')}</b> on ${escapeHtml(c.videoId?.title || '')}
        <p>${escapeHtml(c.text)}</p>
        <button class="dash-btn small danger rm" data-id="${c._id}">Delete</button>
      </div>`).join('')}</div>`;
    el.querySelector('#startLive')?.addEventListener('click', async () => {
      await api('/live/start', { method: 'POST', body: JSON.stringify({ title: 'Live now' }) });
      toast('Stream started', 'success');
      this.modOverview(el, cid);
    });
    el.querySelector('#endLive')?.addEventListener('click', async () => {
      await api(`/live/${el.querySelector('#endLive').dataset.id}/end`, { method: 'POST' });
      this.modOverview(el, cid);
    });
    el.querySelectorAll('.rm').forEach(b => b.onclick = async () => {
      await api(`/comments/${b.dataset.id}`, { method: 'DELETE' });
      this.modOverview(el, cid);
    });
  },

  async modComments(el, cid) {
    const { comments } = await api(`/studio/${cid}/comments`);
    el.innerHTML = `<div class="dash-panel"><h2>Moderate Comments</h2>
      ${comments.map(c => `<div style="padding:12px;border-bottom:1px solid #2a2a2a">
        <b>${escapeHtml(c.authorId?.username || '')}</b> — ${escapeHtml(c.videoId?.title || '')}
        <p>${escapeHtml(c.text)}</p>
        <button class="dash-btn small danger del-m" data-id="${c._id}">Delete</button>
        <button class="dash-btn small secondary hide-u" data-uid="${c.authorId?._id}">Hide User</button>
      </div>`).join('')}</div>`;
    el.querySelectorAll('.del-m').forEach(b => b.onclick = async () => {
      await api(`/comments/${b.dataset.id}`, { method: 'DELETE' });
      this.modComments(el, cid);
    });
    el.querySelectorAll('.hide-u').forEach(b => b.onclick = async () => {
      await api(`/mod/${cid}/hidden-users`, { method: 'POST', body: JSON.stringify({ userId: b.dataset.uid }) });
      toast('User hidden', 'success');
    });
  },

  async modLive(el, cid) {
    const streams = await api('/live/active');
    const stream = streams.streams?.find(s => String(s.channelId?._id || s.channelId) === String(cid));
    if (!stream) {
      el.innerHTML = `<div class="dash-panel"><p>No active stream. <button class="dash-btn" id="goLive">Go Live</button></p></div>`;
      el.querySelector('#goLive').onclick = async () => {
        await api('/live/start', { method: 'POST', body: JSON.stringify({}) });
        this.modLive(el, cid);
      };
      return;
    }
    const chat = await api(`/live/${stream._id}/chat`);
    el.innerHTML = `<div class="dash-panel"><h2>Live Chat — ${escapeHtml(stream.title)}</h2>
      <div style="max-height:400px;overflow-y:auto;margin-bottom:16px">
      ${chat.messages.map(m => `<div style="padding:6px;border-bottom:1px solid #222" data-mid="${m._id}" data-uid="${m.authorId?._id}">
        <b>${escapeHtml(m.authorId?.username || '')}</b>: ${escapeHtml(m.text)}
        <button class="dash-btn small danger del-msg">Del</button>
        <button class="dash-btn small secondary to-msg">Timeout 10m</button>
      </div>`).join('')}</div></div>`;
    el.querySelectorAll('.del-msg').forEach(btn => {
      btn.onclick = async () => {
        const row = btn.closest('[data-mid]');
        await api(`/mod/${cid}/live/${stream._id}/chat/${row.dataset.mid}`, { method: 'DELETE' });
        this.modLive(el, cid);
      };
    });
    el.querySelectorAll('.to-msg').forEach(btn => {
      btn.onclick = async () => {
        const row = btn.closest('[data-uid]');
        await api(`/mod/${cid}/live/${stream._id}/timeout`, { method: 'POST', body: JSON.stringify({ userId: row.dataset.uid, durationSeconds: 600 }) });
        toast('User timed out', 'success');
      };
    });
  },

  async modHidden(el, cid) {
    const { hidden } = await api(`/mod/${cid}/hidden-users`);
    el.innerHTML = `<div class="dash-panel"><h2>Hidden Users</h2>
      <form id="hideForm" class="dash-form" style="display:flex;gap:8px">
        <input id="hideUid" placeholder="User ID"><button class="dash-btn">Hide</button>
      </form>
      <ul style="margin-top:16px">${hidden.map(h => `<li>${escapeHtml(h.userId?.username || h.userId)}
        <button class="dash-btn small secondary unhide" data-uid="${h.userId?._id || h.userId}">Unhide</button></li>`).join('')}</ul></div>`;
    el.querySelector('#hideForm').onsubmit = async e => {
      e.preventDefault();
      await api(`/mod/${cid}/hidden-users`, { method: 'POST', body: JSON.stringify({ userId: el.querySelector('#hideUid').value }) });
      this.modHidden(el, cid);
    };
    el.querySelectorAll('.unhide').forEach(b => b.onclick = async () => {
      await api(`/mod/${cid}/hidden-users/${b.dataset.uid}`, { method: 'DELETE' });
      this.modHidden(el, cid);
    });
  },

  async modChatSettings(el, cid) {
    const { channel } = await api(`/studio/${cid}/settings`);
    const s = channel.chatSettings || {};
    el.innerHTML = `<div class="dash-panel"><h2>Live Chat Settings</h2>
      <form id="chatSetForm" class="dash-form">
        <div class="form-row"><label><input type="checkbox" id="chatEn" ${s.enabled !== false ? 'checked' : ''}> Chat enabled</label></div>
        <div class="form-row"><label>Mode</label><select id="chatMode">
          <option value="everyone">Everyone</option><option value="subscribers" ${s.mode === 'subscribers' ? 'selected' : ''}>Subscribers only</option></select></div>
        <div class="form-row"><label>Slow mode (sec)</label><input type="number" id="chatDelay" value="${s.delaySeconds || 0}" min="0" max="300"></div>
        <button class="dash-btn">Save</button>
      </form></div>`;
    el.querySelector('#chatSetForm').onsubmit = async e => {
      e.preventDefault();
      await api(`/mod/${cid}/chat-settings`, { method: 'PATCH', body: JSON.stringify({
        enabled: el.querySelector('#chatEn').checked,
        mode: el.querySelector('#chatMode').value,
        delaySeconds: Number(el.querySelector('#chatDelay').value)
      })});
      toast('Saved', 'success');
    };
  },

  async modBlocked(el, cid) {
    const { words } = await api(`/mod/${cid}/blocked-words`);
    el.innerHTML = `<div class="dash-panel"><h2>Blocked Words</h2>
      <form id="bwForm" style="display:flex;gap:8px;margin-bottom:16px">
        <input id="bwPhrase" placeholder="Word or phrase"><button class="dash-btn">Add</button>
      </form>
      <ul>${words.map(w => `<li>${escapeHtml(w.phrase)} <button class="dash-btn small danger rm-w" data-id="${w._id}">Remove</button></li>`).join('')}</ul></div>`;
    el.querySelector('#bwForm').onsubmit = async e => {
      e.preventDefault();
      await api(`/mod/${cid}/blocked-words`, { method: 'POST', body: JSON.stringify({ phrase: el.querySelector('#bwPhrase').value }) });
      this.modBlocked(el, cid);
    };
    el.querySelectorAll('.rm-w').forEach(b => b.onclick = async () => {
      await api(`/mod/${cid}/blocked-words/${b.dataset.id}`, { method: 'DELETE' });
      this.modBlocked(el, cid);
    });
  },

  async modRoster(el, cid) {
    const { moderators } = await api(`/mod/${cid}/live-moderators`);
    el.innerHTML = `<div class="dash-panel"><h2>Mod Roster</h2>
      <form id="addMod" style="display:flex;gap:8px;margin-bottom:16px">
        <input id="modUid" placeholder="User ID">
        <select id="modRole"><option value="standard_moderator">Standard</option><option value="managing_moderator">Managing</option></select>
        <button class="dash-btn">Add</button>
      </form>
      <ul>${moderators.map(m => `<li>${escapeHtml(m.userId?.username || '')} — ${m.role}</li>`).join('')}</ul></div>`;
    el.querySelector('#addMod').onsubmit = async e => {
      e.preventDefault();
      await api(`/mod/${cid}/live-moderators`, { method: 'POST', body: JSON.stringify({
        userId: el.querySelector('#modUid').value, role: el.querySelector('#modRole').value
      })});
      this.modRoster(el, cid);
    };
  },

  // --- Admin ---
  async adminDashboard(el) {
    const { stats } = await api('/admin/stats');
    el.innerHTML = `
      <div class="dash-cards">
        <div class="dash-card"><h3>${stats.users}</h3><p>Total Users</p></div>
        <div class="dash-card"><h3>${stats.videos}</h3><p>Total Videos</p></div>
        <div class="dash-card"><h3>${stats.publishedVideos}</h3><p>Published</p></div>
        <div class="dash-card"><h3>${formatViews(stats.totalViews)}</h3><p>Total Views</p></div>
      </div>
      <div class="dash-panel"><h2>Platform Announcement</h2>
        <div class="dash-form">
          <div class="form-row"><label>Title</label><input id="annTitle"></div>
          <div class="form-row"><label>Message</label><textarea id="annBody" rows="3" style="max-width:100%"></textarea></div>
          <button class="dash-btn" id="sendAnn">Send</button>
        </div></div>`;
    el.querySelector('#sendAnn').onclick = async () => {
      await api('/admin/announce', { method: 'POST', body: JSON.stringify({
        title: el.querySelector('#annTitle').value, body: el.querySelector('#annBody').value
      })});
      toast('Sent', 'success');
    };
  },

  async adminUsers(el) {
    const { users } = await api('/admin/users');
    el.innerHTML = `<div class="dash-panel"><h2>Users</h2>
      <table class="dash-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => `<tr>
        <td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.email)}</td><td>${u.platformRole}</td>
        <td>${u.isBanned ? 'Banned' : 'Active'}</td>
        <td><button class="dash-btn small secondary ban-btn" data-id="${u._id}" data-banned="${!u.isBanned}">${u.isBanned ? 'Unban' : 'Ban'}</button>
        ${u.platformRole !== 'platform_admin' ? `<button class="dash-btn small promote-btn" data-id="${u._id}">Make Admin</button>` : ''}</td>
      </tr>`).join('')}</tbody></table></div>`;
    el.querySelectorAll('.ban-btn').forEach(btn => btn.onclick = async () => {
      await api(`/admin/users/${btn.dataset.id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: btn.dataset.banned === 'true' }) });
      this.adminUsers(el);
    });
    el.querySelectorAll('.promote-btn').forEach(btn => btn.onclick = async () => {
      await api(`/admin/users/${btn.dataset.id}/platform-role`, { method: 'PATCH', body: JSON.stringify({ role: 'platform_admin' }) });
      toast('Promoted', 'success');
      this.adminUsers(el);
    });
  },

  async adminVideos(el) {
    const { videos } = await api('/admin/videos');
    el.innerHTML = `<div class="dash-panel"><h2>All Videos</h2>
      <table class="dash-table"><thead><tr><th>Title</th><th>Creator</th><th>Status</th><th>Views</th><th>Actions</th></tr></thead>
      <tbody>${videos.map(v => `<tr>
        <td>${escapeHtml(v.title)}</td><td>${escapeHtml(v.uploadedBy?.username || '')}</td>
        <td class="status-${v.status}">${v.status}</td><td>${v.views}</td>
        <td><button class="dash-btn small toggle-pub" data-id="${v._id}" data-status="${v.status === 'published' ? 'unpublished' : 'published'}">
          ${v.status === 'published' ? 'Unpublish' : 'Publish'}</button></td>
      </tr>`).join('')}</tbody></table></div>`;
    el.querySelectorAll('.toggle-pub').forEach(btn => btn.onclick = async () => {
      await api(`/admin/videos/${btn.dataset.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: btn.dataset.status }) });
      this.adminVideos(el);
    });
  },

  async adminAudit(el) {
    const { logs } = await api('/admin/audit-logs');
    el.innerHTML = `<div class="dash-panel"><h2>Audit Log</h2>
      <table class="dash-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th></tr></thead>
      <tbody>${logs.map(l => `<tr><td>${formatDate(l.createdAt)}</td><td>${escapeHtml(l.actorId?.username || 'System')}</td>
        <td>${escapeHtml(l.action)}</td></tr>`).join('')}</tbody></table></div>`;
  }
};
