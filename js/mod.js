let view = 'dashboard';
let channelId = null;

async function render() {
  const app = document.getElementById('app');
  if (!getToken()) {
    app.innerHTML = `<div class="dash-login"><h2>Moderation Console</h2><p>Please <a href="/">sign in</a> first.</p></div>`;
    return;
  }

  const user = getUser() || await refreshUser();
  channelId = user._id;
  const cid = channelId;

  const access = await api('/auth/access').catch(() => null);
  const canMod = access?.canAccessMod || access?.isPlatformAdmin;
  if (!canMod) {
    app.innerHTML = `<div class="dash-login"><h2>Access Denied</h2><p>You need moderator permissions. Ask a channel manager to invite you.</p><a href="/studio">Creator Studio</a></div>`;
    return;
  }

  const isManaging = access?.isPlatformAdmin ||
    access?.memberships?.some(m => m.channelId?.toString() === cid && m.role === 'managing_moderator') ||
    user.platformRole === 'platform_admin';

  app.innerHTML = renderDashboardHeader('Moderation Console', []) + `
    <div class="dash-layout">
      <aside class="dash-sidebar">
        <a href="#dashboard" class="${view==='dashboard'?'active':''}"><i class="fas fa-home"></i> Overview</a>
        <a href="#comments" class="${view==='comments'?'active':''}"><i class="fas fa-comments"></i> Comments</a>
        <a href="#live" class="${view==='live'?'active':''}"><i class="fas fa-broadcast-tower"></i> Live Chat</a>
        <a href="#hidden" class="${view==='hidden'?'active':''}"><i class="fas fa-user-slash"></i> Hidden Users</a>
        ${isManaging ? `<a href="#chat-settings" class="${view==='chat-settings'?'active':''}"><i class="fas fa-cog"></i> Chat Settings</a>
        <a href="#blocked" class="${view==='blocked'?'active':''}"><i class="fas fa-ban"></i> Blocked Words</a>
        <a href="#mod-roster" class="${view==='mod-roster'?'active':''}"><i class="fas fa-user-shield"></i> Mod Roster</a>` : ''}
        <a href="/studio"><i class="fas fa-sliders-h"></i> Studio</a>
      </aside>
      <main class="dash-main" id="mainContent">Loading...</main>
    </div>`;

  document.getElementById('dashLogout').onclick = () => { setAuth(null); location.href = '/'; };
  initDashNotifications();

  if (view === 'dashboard') await renderOverview(cid);
  else if (view === 'comments') await renderComments(cid);
  else if (view === 'live') await renderLive(cid, isManaging);
  else if (view === 'hidden') await renderHidden(cid);
  else if (view === 'chat-settings' && isManaging) await renderChatSettings(cid);
  else if (view === 'blocked' && isManaging) await renderBlocked(cid);
  else if (view === 'mod-roster' && isManaging) await renderModRoster(cid);
}

async function renderOverview(cid) {
  const data = await api(`/mod/${cid}/dashboard`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-cards">
      <div class="dash-card"><h3>${data.activeStream ? 'LIVE' : '—'}</h3><p>Stream Status</p></div>
      <div class="dash-card"><h3>${data.recentComments?.length||0}</h3><p>Recent Comments</p></div>
    </div>
    ${!data.activeStream ? `<button class="dash-btn" id="startLive">Start Live Stream</button>` : `
      <button class="dash-btn danger" id="endLive" data-id="${data.activeStream._id}">End Stream</button>`}
    <div class="dash-panel" style="margin-top:20px"><h2>Recent Comments</h2>
    ${(data.recentComments||[]).map(c=>`<div style="padding:8px;border-bottom:1px solid #2a2a2a">
      <b>${escapeHtml(c.authorId?.username||'')}</b> on ${escapeHtml(c.videoId?.title||'')}
      <p>${escapeHtml(c.text)}</p>
      <button class="dash-btn small danger rm" data-id="${c._id}">Delete</button>
    </div>`).join('')}</div>`;
  document.getElementById('startLive')?.addEventListener('click', async () => {
    await api('/live/start', { method: 'POST', body: JSON.stringify({ title: 'Live now' }) });
    toast('Stream started', 'success');
    renderOverview(cid);
  });
  document.getElementById('endLive')?.addEventListener('click', async () => {
    await api(`/live/${document.getElementById('endLive').dataset.id}/end`, { method: 'POST' });
    renderOverview(cid);
  });
  document.querySelectorAll('.rm').forEach(b => b.onclick = async () => {
    await api(`/comments/${b.dataset.id}`, { method: 'DELETE' });
    renderOverview(cid);
  });
}

async function renderComments(cid) {
  const { comments } = await api(`/studio/${cid}/comments`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Moderate Comments</h2>
    ${comments.map(c=>`<div style="padding:12px;border-bottom:1px solid #2a2a2a">
      <b>${escapeHtml(c.authorId?.username||'')}</b> — ${escapeHtml(c.videoId?.title||'')}
      <p>${escapeHtml(c.text)}</p>
      <button class="dash-btn small danger" data-id="${c._id}">Delete</button>
      <button class="dash-btn small secondary hide-u" data-uid="${c.authorId?._id}">Hide User</button>
    </div>`).join('')}</div>`;
  document.querySelectorAll('.danger').forEach(b=>b.onclick=async()=>{
    await api(`/comments/${b.dataset.id}`,{method:'DELETE'});
    renderComments(cid);
  });
  document.querySelectorAll('.hide-u').forEach(b=>b.onclick=async()=>{
    await api(`/mod/${cid}/hidden-users`,{method:'POST',body:JSON.stringify({userId:b.dataset.uid})});
    toast('User hidden from channel','success');
  });
}

async function renderLive(cid, isManaging) {
  const streams = await api('/live/active');
  const stream = streams.streams?.find(s => s.channelId?._id === cid || s.channelId === cid);
  if (!stream) {
    document.getElementById('mainContent').innerHTML = `<div class="dash-panel"><p>No active live stream. <button class="dash-btn" id="goLive">Go Live</button></p></div>`;
    document.getElementById('goLive').onclick = async () => {
      await api('/live/start', { method: 'POST', body: JSON.stringify({}) });
      renderLive(cid, isManaging);
    };
    return;
  }
  const chat = await api(`/live/${stream._id}/chat`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Live Chat — ${escapeHtml(stream.title)}</h2>
    <div id="chatBox" style="max-height:400px;overflow-y:auto;margin-bottom:16px">
    ${chat.messages.map(m=>`<div style="padding:6px;border-bottom:1px solid #222" data-mid="${m._id}" data-uid="${m.authorId?._id}">
      <b>${escapeHtml(m.authorId?.username||'')}</b>: ${escapeHtml(m.text)}
      <button class="dash-btn small danger del-m">Del</button>
      <button class="dash-btn small secondary to-m">Timeout 10m</button>
    </div>`).join('')}</div>
    ${isManaging ? `<p>Mode: ${chat.chatSettings?.mode||'everyone'} | Delay: ${chat.chatSettings?.delaySeconds||0}s</p>` : ''}
    </div>`;
  document.querySelectorAll('.del-m').forEach((btn,i)=>{
    btn.onclick=async()=>{
      const row=btn.closest('[data-mid]');
      await api(`/mod/${cid}/live/${stream._id}/chat/${row.dataset.mid}`,{method:'DELETE'});
      renderLive(cid,isManaging);
    };
  });
  document.querySelectorAll('.to-m').forEach(btn=>{
    btn.onclick=async()=>{
      const row=btn.closest('[data-uid]');
      await api(`/mod/${cid}/live/${stream._id}/timeout`,{method:'POST',body:JSON.stringify({userId:row.dataset.uid,durationSeconds:600})});
      toast('User timed out 10 minutes','success');
    };
  });
  setTimeout(()=>renderLive(cid,isManaging),5000);
}

async function renderHidden(cid) {
  const { hidden } = await api(`/mod/${cid}/hidden-users`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Hidden Users</h2>
    <form id="hideForm" class="dash-form" style="display:flex;gap:8px">
      <input id="hideUid" placeholder="User ID to hide">
      <button class="dash-btn">Hide User</button>
    </form>
    <ul style="margin-top:16px">${hidden.map(h=>`<li>${escapeHtml(h.userId?.username||h.userId)} 
      <button class="dash-btn small secondary unhide" data-uid="${h.userId?._id||h.userId}">Unhide</button></li>`).join('')}</ul></div>`;
  document.getElementById('hideForm').onsubmit=async e=>{
    e.preventDefault();
    await api(`/mod/${cid}/hidden-users`,{method:'POST',body:JSON.stringify({userId:document.getElementById('hideUid').value})});
    renderHidden(cid);
  };
  document.querySelectorAll('.unhide').forEach(b=>b.onclick=async()=>{
    await api(`/mod/${cid}/hidden-users/${b.dataset.uid}`,{method:'DELETE'});
    renderHidden(cid);
  });
}

async function renderChatSettings(cid) {
  const { channel } = await api(`/studio/${cid}/settings`);
  const s = channel.chatSettings || {};
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Live Chat Settings</h2>
    <form id="chatSetForm" class="dash-form">
      <div class="form-row"><label><input type="checkbox" id="chatEn" ${s.enabled!==false?'checked':''}> Chat enabled</label></div>
      <div class="form-row"><label>Mode</label>
        <select id="chatMode"><option value="everyone">Everyone</option>
        <option value="subscribers" ${s.mode==='subscribers'?'selected':''}>Subscribers only</option></select></div>
      <div class="form-row"><label>Slow mode (seconds)</label><input type="number" id="chatDelay" value="${s.delaySeconds||0}" min="0" max="300"></div>
      <button class="dash-btn">Save</button>
    </form></div>`;
  document.getElementById('chatSetForm').onsubmit=async e=>{
    e.preventDefault();
    await api(`/mod/${cid}/chat-settings`,{method:'PATCH',body:JSON.stringify({
      enabled: document.getElementById('chatEn').checked,
      mode: document.getElementById('chatMode').value,
      delaySeconds: Number(document.getElementById('chatDelay').value)
    })});
    toast('Saved','success');
  };
}

async function renderBlocked(cid) {
  const { words } = await api(`/mod/${cid}/blocked-words`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Blocked Words</h2>
    <form id="bwForm" style="display:flex;gap:8px;margin-bottom:16px">
      <input id="bwPhrase" placeholder="Word or phrase">
      <button class="dash-btn">Add</button>
    </form>
    <ul>${words.map(w=>`<li>${escapeHtml(w.phrase)} <button class="dash-btn small danger" data-id="${w._id}">Remove</button></li>`).join('')}</ul></div>`;
  document.getElementById('bwForm').onsubmit=async e=>{
    e.preventDefault();
    await api(`/mod/${cid}/blocked-words`,{method:'POST',body:JSON.stringify({phrase:document.getElementById('bwPhrase').value})});
    renderBlocked(cid);
  };
  document.querySelectorAll('.danger').forEach(b=>b.onclick=async()=>{
    await api(`/mod/${cid}/blocked-words/${b.dataset.id}`,{method:'DELETE'});
    renderBlocked(cid);
  });
}

async function renderModRoster(cid) {
  const { moderators } = await api(`/mod/${cid}/live-moderators`);
  document.getElementById('mainContent').innerHTML = `
    <div class="dash-panel"><h2>Live Chat Moderators</h2>
    <form id="addMod" style="display:flex;gap:8px;margin-bottom:16px">
      <input id="modUid" placeholder="User ID">
      <select id="modRole"><option value="standard_moderator">Standard</option><option value="managing_moderator">Managing</option></select>
      <button class="dash-btn">Add</button>
    </form>
    <ul>${moderators.map(m=>`<li>${escapeHtml(m.userId?.username||'')} — ${m.role}</li>`).join('')}</ul></div>`;
  document.getElementById('addMod').onsubmit=async e=>{
    e.preventDefault();
    await api(`/mod/${cid}/live-moderators`,{method:'POST',body:JSON.stringify({
      userId:document.getElementById('modUid').value,
      role:document.getElementById('modRole').value
    })});
    renderModRoster(cid);
  };
}

window.addEventListener('hashchange', () => { view = location.hash.slice(1) || 'dashboard'; render(); });
view = location.hash.slice(1) || 'dashboard';
render();
