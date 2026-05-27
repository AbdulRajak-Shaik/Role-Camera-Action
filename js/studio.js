let view = 'dashboard';
let channelId = null;

async function getChannelId() {
  const user = getUser() || await refreshUser();
  return user?._id || user?.channelId;
}

async function render() {
  const app = document.getElementById('app');
  if (!getToken()) {
    app.innerHTML = `<div class="dash-login"><h2>Creator Studio</h2><p>Please <a href="/">sign in</a> first.</p></div>`;
    return;
  }

  channelId = await getChannelId();
  const cid = channelId;

  const links = [
    { href: '#dashboard', label: 'Dashboard', active: view === 'dashboard' },
    { href: '#videos', label: 'Content', active: view === 'videos' },
    { href: '#community', label: 'Community', active: view === 'community' },
    { href: '#team', label: 'Team', active: view === 'team' }
  ];

  app.innerHTML = renderDashboardHeader('Creator Studio', links) + `
    <div class="dash-layout">
      <aside class="dash-sidebar">
        <a href="#dashboard" class="${view==='dashboard'?'active':''}"><i class="fas fa-chart-line"></i> Analytics</a>
        <a href="#videos" class="${view==='videos'?'active':''}"><i class="fas fa-video"></i> Videos & Shorts</a>
        <a href="#upload" class="${view==='upload'?'active':''}"><i class="fas fa-upload"></i> Upload</a>
        <a href="#community" class="${view==='community'?'active':''}"><i class="fas fa-users"></i> Community</a>
        <a href="#comments" class="${view==='comments'?'active':''}"><i class="fas fa-comments"></i> Comments</a>
        <a href="#team" class="${view==='team'?'active':''}"><i class="fas fa-user-friends"></i> Team</a>
        <a href="/mod"><i class="fas fa-gavel"></i> Moderation</a>
      </aside>
      <main class="dash-main" id="mainContent">Loading...</main>
    </div>`;

  document.getElementById('dashLogout').onclick = () => { setAuth(null); location.href = '/'; };
  initDashNotifications();

  if (view === 'dashboard') await renderAnalytics(cid);
  else if (view === 'videos') await renderVideos(cid);
  else if (view === 'upload') await renderUpload(cid);
  else if (view === 'community') await renderCommunity(cid);
  else if (view === 'comments') await renderComments(cid);
  else if (view === 'team') await renderTeam(cid);
}

async function renderAnalytics(cid) {
  const { analytics } = await api(`/studio/${cid}/analytics`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-cards">
      <div class="dash-card"><h3>${formatViews(analytics.totalViews)}</h3><p>Total Views</p></div>
      <div class="dash-card"><h3>${analytics.totalLikes}</h3><p>Total Likes</p></div>
      <div class="dash-card"><h3>${analytics.videoCount}</h3><p>Videos</p></div>
      <div class="dash-card"><h3>${formatViews(analytics.subscribers)}</h3><p>Subscribers</p></div>
    </div>
    <div class="dash-panel"><h2>Top Videos</h2>
    <table class="dash-table"><thead><tr><th>Title</th><th>Views</th><th>Likes</th></tr></thead>
    <tbody>${(analytics.topVideos||[]).map(v=>`<tr><td>${escapeHtml(v.title)}</td><td>${v.views}</td><td>${v.likes}</td></tr>`).join('')}</tbody></table></div>`;
}

async function renderVideos(cid) {
  const { videos } = await api(`/studio/${cid}/videos`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Your Videos</h2>
    <table class="dash-table"><thead><tr><th>Title</th><th>Genre</th><th>Status</th><th>Short</th><th>Actions</th></tr></thead>
    <tbody>${videos.map(v=>`<tr>
      <td>${escapeHtml(v.title)}</td><td>${v.genre}</td>
      <td class="status-${v.status}">${v.status}</td><td>${v.isShort?'Yes':'No'}</td>
      <td>
        ${v.status!=='published'?`<button class="dash-btn small pub-btn" data-id="${v._id}">Publish</button>`:''}
        ${v.status==='published'?`<button class="dash-btn small secondary unpub-btn" data-id="${v._id}">Unpublish</button>`:''}
        <button class="dash-btn small danger del-btn" data-id="${v._id}">Delete</button>
      </td></tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('.pub-btn').forEach(b=>b.onclick=async()=>{
    await api(`/studio/${cid}/videos/${b.dataset.id}/publish`,{method:'POST'});
    toast('Published! Subscribers notified.','success'); renderVideos(cid);
  });
  document.querySelectorAll('.unpub-btn').forEach(b=>b.onclick=async()=>{
    await api(`/studio/${cid}/videos/${b.dataset.id}/unpublish`,{method:'POST'});
    renderVideos(cid);
  });
  document.querySelectorAll('.del-btn').forEach(b=>b.onclick=async()=>{
    if(confirm('Delete this video?')){ await api(`/studio/${cid}/videos/${b.dataset.id}`,{method:'DELETE'}); renderVideos(cid); }
  });
}

async function renderUpload(cid) {
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Upload Video / Short</h2>
    <form id="uploadForm" class="dash-form">
      <div class="form-row"><label>Video file</label><input type="file" id="vf" accept="video/*" required></div>
      <div class="form-row"><label>Title</label><input id="vt" required></div>
      <div class="form-row"><label>Description</label><textarea id="vd" rows="3" style="max-width:100%"></textarea></div>
      <div class="form-row"><label>Genre</label>
        <select id="vg"><option value="drama">Drama</option><option value="comedy">Comedy</option><option value="action">Action</option>
        <option value="romance">Romance</option><option value="horror">Horror</option><option value="documentary">Documentary</option><option value="auditions">Auditions</option></select>
      </div>
      <div class="form-row"><label><input type="checkbox" id="vs"> Short (&lt;60s vertical)</label></div>
      <div class="form-row"><label>Status</label><select id="vst"><option value="draft">Draft</option><option value="published">Publish immediately</option></select></div>
      <button type="submit" class="dash-btn">Upload</button>
    </form></div>`;
  document.getElementById('uploadForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('video', document.getElementById('vf').files[0]);
    fd.append('title', document.getElementById('vt').value);
    fd.append('description', document.getElementById('vd').value);
    fd.append('genre', document.getElementById('vg').value);
    fd.append('isShort', document.getElementById('vs').checked);
    fd.append('status', document.getElementById('vst').value);
    const res = await fetch(`/api/studio/${cid}/videos`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
    const data = await res.json();
    if (data.success) {
      if (document.getElementById('vst').value === 'published') {
        await api(`/studio/${cid}/videos/${data.video._id}/publish`, { method: 'POST' });
      }
      toast('Uploaded!', 'success');
      location.hash = 'videos';
    } else toast(data.error || 'Upload failed', 'error');
  };
}

async function renderCommunity(cid) {
  const { posts } = await api(`/studio/${cid}/community`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Community Posts</h2>
    <form id="postForm" class="dash-form" style="margin-bottom:20px">
      <div class="form-row"><textarea id="postContent" rows="3" placeholder="Share an update..." style="max-width:100%"></textarea></div>
      <button class="dash-btn" type="submit">Post</button>
    </form>
    ${posts.map(p=>`<div style="padding:12px;border-bottom:1px solid #2a2a2a"><p>${escapeHtml(p.content)}</p><small>${formatDate(p.createdAt)}</small>
    <button class="dash-btn small danger del-post" data-id="${p._id}">Delete</button></div>`).join('')||'<p>No posts yet</p>'}</div>`;
  document.getElementById('postForm').onsubmit = async e => {
    e.preventDefault();
    await api(`/studio/${cid}/community`, { method: 'POST', body: JSON.stringify({ content: document.getElementById('postContent').value }) });
    toast('Posted! Subscribers with community notifications will be alerted.', 'success');
    renderCommunity(cid);
  };
  document.querySelectorAll('.del-post').forEach(b=>b.onclick=async()=>{
    await api(`/studio/${cid}/community/${b.dataset.id}`,{method:'DELETE'});
    renderCommunity(cid);
  });
}

async function renderComments(cid) {
  const { comments } = await api(`/studio/${cid}/comments`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Comments Inbox</h2>
    <table class="dash-table"><thead><tr><th>Video</th><th>User</th><th>Comment</th><th>Actions</th></tr></thead>
    <tbody>${comments.map(c=>`<tr>
      <td>${escapeHtml(c.videoId?.title||'')}</td>
      <td>${escapeHtml(c.authorId?.username||'')}</td>
      <td>${escapeHtml(c.text)}</td>
      <td><button class="dash-btn small danger del-c" data-id="${c._id}">Remove</button>
      <button class="dash-btn small secondary pin-c" data-id="${c._id}">Pin</button></td>
    </tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('.del-c').forEach(b=>b.onclick=async()=>{
    await api(`/comments/${b.dataset.id}`,{method:'DELETE'});
    renderComments(cid);
  });
  document.querySelectorAll('.pin-c').forEach(b=>b.onclick=async()=>{
    await api(`/comments/${b.dataset.id}/pin`,{method:'PUT'});
    toast('Pinned','success');
  });
}

async function renderTeam(cid) {
  const { members } = await api(`/studio/${cid}/team`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Team Members</h2>
    <form id="inviteForm" class="dash-form" style="margin-bottom:20px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
      <div class="form-row" style="margin:0"><label>Email</label><input type="email" id="invEmail"></div>
      <div class="form-row" style="margin:0"><label>Role</label>
        <select id="invRole">
          <option value="manager">Manager</option><option value="editor">Editor</option><option value="viewer">Viewer</option>
          <option value="managing_moderator">Managing Moderator</option><option value="standard_moderator">Standard Moderator</option>
        </select></div>
      <button class="dash-btn" type="submit">Invite</button>
    </form>
    <table class="dash-table"><thead><tr><th>User</th><th>Role</th><th>Actions</th></tr></thead>
    <tbody>${members.map(m=>`<tr>
      <td>${escapeHtml(m.userId?.username||m.userId?.email||'')}</td>
      <td>${m.role}</td>
      <td><button class="dash-btn small danger rm-m" data-uid="${m.userId?._id}">Remove</button></td>
    </tr>`).join('')}</tbody></table></div>`;
  document.getElementById('inviteForm').onsubmit = async e => {
    e.preventDefault();
    await api(`/studio/${cid}/team/invite`, { method: 'POST', body: JSON.stringify({
      email: document.getElementById('invEmail').value,
      role: document.getElementById('invRole').value
    })});
    toast('Invited!','success');
    renderTeam(cid);
  };
  document.querySelectorAll('.rm-m').forEach(b=>b.onclick=async()=>{
    await api(`/studio/${cid}/team/${b.dataset.uid}`,{method:'DELETE'});
    renderTeam(cid);
  });
}

window.addEventListener('hashchange', () => { view = location.hash.slice(1) || 'dashboard'; render(); });
view = location.hash.slice(1) || 'dashboard';
render();
