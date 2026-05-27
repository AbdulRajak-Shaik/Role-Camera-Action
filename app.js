/* Role Camera Action! - Full Platform */

const API_BASE = '/api';
const MEDIA_BASE = '';

let currentUser = null;
let token = localStorage.getItem('rca_token') || null;
let videos = [];
let currentGenre = 'all';
let currentSort = 'newest';
let currentSearch = '';
let currentView = 'home';
let currentVideo = null;
let channelNotifications = { uploads: true, community: false, live: false };
let currentAppView = 'home';
let userAccess = null;
let googleClientId = '';

// DOM
const videoGrid = document.getElementById('videoGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const sectionTitle = document.getElementById('sectionTitle');
const emptyState = document.getElementById('emptyState');
const videoModal = document.getElementById('videoModal');
const uploadModal = document.getElementById('uploadModal');
const sidebar = document.getElementById('sidebar');
const mobileMenu = document.getElementById('mobileMenu');
const signInModal = document.getElementById('signInModal');
const signUpModal = document.getElementById('signUpModal');
const authRequiredModal = document.getElementById('authRequiredModal');

function getAuthHeader() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function setAuth(newToken, user = null) {
  token = newToken;
  currentUser = user;
  if (newToken && user) {
    localStorage.setItem('rca_token', newToken);
    localStorage.setItem('rca_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('rca_token');
    localStorage.removeItem('rca_user');
    currentUser = null;
    token = null;
  }
}

function getCurrentUser() {
  if (currentUser) return currentUser;
  try {
    currentUser = JSON.parse(localStorage.getItem('rca_user')) || null;
    return currentUser;
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return !!(getCurrentUser() && token);
}

async function signUp(username, email, password) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });
  const data = await response.json();
  if (response.ok && data.success) {
      setAuth(data.token, data.user);
      updateAuthUI();
      return { success: true, user: data.user };
    }
    return { success: false, error: data.error || 'Registration failed' };
}

async function signIn(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (response.ok && data.success) {
    setAuth(data.token, data.user);
    return { success: true, user: data.user };
  }
  return { success: false, error: data.error || 'Login failed' };
}

async function signInWithGoogle(credential) {
  const response = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  const data = await response.json();
  if (response.ok && data.success) {
    setAuth(data.token, data.user);
    return { success: true, user: data.user };
  }
  return { success: false, error: data.error || 'Google sign-in failed' };
}

function signOut() {
  closeDashboard();
  setAuth(null);
  updateAuthUI();
  currentView = 'home';
  loadVideos();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatViews(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Recently';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function formatSubs(n) {
  return `${formatViews(n || 0)} subscribers`;
}

function setAppView(view) {
  currentAppView = view;
}

function openDashboard(app, subView = 'dashboard') {
  if (typeof Dashboards !== 'undefined') {
    Dashboards.open(app, subView);
  }
}

function closeDashboard() {
  if (typeof Dashboards !== 'undefined') {
    Dashboards.close();
  }
}

async function updateToolsNav() {
  const loggedIn = isLoggedIn();
  const show = el => { if (el) el.style.display = 'flex'; };
  const hide = el => { if (el) el.style.display = 'none'; };

  document.querySelectorAll('.logged-tools').forEach(el => {
    el.style.display = loggedIn ? (el.classList.contains('sidebar-divider') ? 'block' : el.tagName === 'SPAN' ? 'block' : 'flex') : 'none';
  });

  if (!loggedIn) {
    hide(document.getElementById('studioBtn'));
    hide(document.getElementById('sidebarStudio'));
    hide(document.getElementById('modBtn'));
    hide(document.getElementById('sidebarMod'));
    hide(document.getElementById('adminLink'));
    hide(document.getElementById('sidebarAdmin'));
    userAccess = null;
    return;
  }

  show(document.getElementById('sidebarStudio'));
  show(document.getElementById('studioBtn'));

  const user = getCurrentUser();
  if (user?.platformRole === 'platform_admin') {
    show(document.getElementById('adminLink'));
    show(document.getElementById('sidebarAdmin'));
  } else {
    hide(document.getElementById('adminLink'));
    hide(document.getElementById('sidebarAdmin'));
  }

  try {
    const res = await fetch(`${API_BASE}/auth/access`, { headers: getAuthHeader() });
    const data = await res.json();
    userAccess = data;
    if (data.canAccessMod || data.isPlatformAdmin) {
      show(document.getElementById('modBtn'));
      show(document.getElementById('sidebarMod'));
    } else {
      hide(document.getElementById('modBtn'));
      hide(document.getElementById('sidebarMod'));
    }
  } catch {
    userAccess = null;
    hide(document.getElementById('modBtn'));
    hide(document.getElementById('sidebarMod'));
  }
}

function handleHashRoute() {
  try {
    const route = typeof Dashboards !== 'undefined' ? Dashboards.parseHash() : null;
    if (route) {
      Dashboards.open(route.app, route.sub);
    } else if (currentAppView !== 'home') {
      closeDashboard();
    }
  } catch (err) {
    console.error('Hash route error:', err);
    closeDashboard();
  }
}

function showNotification(message, type = 'info') {
  let el = document.querySelector('.toast-notification');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast-notification';
    document.body.appendChild(el);
  }
  el.className = `toast-notification ${type} show`;
  el.textContent = message;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3500);
}

function showAuthRequired(action) {
  document.getElementById('authRequiredMessage').textContent =
    `Please sign in to ${action}.`;
  authRequiredModal.classList.add('active');
}

function updateStats() {
  const totalVideosEl = document.getElementById('totalVideos');
  if (totalVideosEl) totalVideosEl.textContent = videos.length;
}

function getGenreTitle(genre) {
  const titles = {
    all: 'All Videos',
    drama: 'Drama',
    comedy: 'Comedy',
    action: 'Action',
    romance: 'Romance',
    horror: 'Horror',
    documentary: 'Documentary',
    auditions: 'Auditions',
    subscriptions: 'Subscriptions',
    liked: 'Liked Videos',
    my: 'My Videos'
  };
  return titles[genre] || 'Videos';
}

async function loadVideos() {
  currentView = 'home';
  try {
    const params = new URLSearchParams({
      sort: currentSort,
      search: currentSearch
    });
    if (currentGenre && currentGenre !== 'all') params.set('genre', currentGenre);

    const response = await fetch(`${API_BASE}/videos?${params}`);
    const data = await response.json();
    videos = data.videos || [];
    sectionTitle.textContent = getGenreTitle(currentGenre);
    renderVideos(videos);
    updateStats();
  } catch (error) {
    console.error('Load videos error:', error);
    videos = [];
    renderVideos([]);
    showNotification('Failed to load videos. Is the server running?', 'error');
  }
}

async function loadMyVideos() {
  if (!isLoggedIn()) return showAuthRequired('view your videos');
  currentView = 'my';
  try {
    const response = await fetch(`${API_BASE}/videos/my`, { headers: getAuthHeader() });
    const data = await response.json();
    if (data.success) {
      sectionTitle.textContent = 'My Videos';
      renderVideos(data.videos);
    }
  } catch {
    showNotification('Failed to load your videos', 'error');
  }
}

async function loadLikedVideos() {
  if (!isLoggedIn()) return showAuthRequired('view liked videos');
  currentView = 'liked';
  try {
    const response = await fetch(`${API_BASE}/videos/liked`, { headers: getAuthHeader() });
    const data = await response.json();
    if (data.success) {
      sectionTitle.textContent = 'Liked Videos';
      renderVideos(data.videos);
    }
  } catch {
    showNotification('Failed to load liked videos', 'error');
  }
}

async function loadSubscriptionFeed() {
  if (!isLoggedIn()) return showAuthRequired('view subscriptions');
  currentView = 'subscriptions';
  try {
    const response = await fetch(`${API_BASE}/videos/feed/subscriptions`, {
      headers: getAuthHeader()
    });
    const data = await response.json();
    if (data.success) {
      sectionTitle.textContent = 'Subscriptions';
      renderVideos(data.videos);
      if (!data.videos.length) {
        showNotification('Subscribe to creators to see their latest videos here', 'info');
      }
    }
  } catch {
    showNotification('Failed to load subscription feed', 'error');
  }
}

function renderVideos(videoList) {
  if (!videoList.length) {
    videoGrid.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  videoGrid.innerHTML = videoList.map((video, index) => {
    const channel = video.uploadedBy || {};
    const thumb = video.thumbnail || `${MEDIA_BASE}/uploads/placeholder.jpg`;
    const avatar = channel.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.username || 'U')}&background=E50914&color=fff`;
    return `
    <div class="video-card" data-id="${video._id}" style="animation-delay: ${index * 0.05}s">
      <div class="thumbnail-container">
        <div class="thumbnail-placeholder"><i class="fas fa-play-circle"></i></div>
        <span class="genre-tag">${video.genre || 'all'}</span>
        <span class="duration-badge">${video.duration || ''}</span>
        <div class="thumbnail-overlay">
          <div class="play-icon"><i class="fas fa-play"></i></div>
        </div>
      </div>
      <div class="video-content">
        <h3>${escapeHtml(video.title)}</h3>
        <div class="video-channel">
          <img src="${avatar}" alt="${escapeHtml(channel.username || '')}" class="channel-icon">
          <span class="channel-name">${escapeHtml(channel.username || 'Unknown')}</span>
        </div>
        <div class="video-stats">
          <span><i class="fas fa-eye"></i> ${formatViews(video.views || 0)} views</span>
          <span><i class="fas fa-clock"></i> ${formatDate(video.createdAt)}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.video-card').forEach(card => {
    card.addEventListener('click', () => openVideoModal(card.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function openVideoModal(videoId) {
  try {
    const response = await fetch(`${API_BASE}/videos/${videoId}`, { headers: getAuthHeader() });
    const data = await response.json();
    if (!data.success) throw new Error(data.error);

    const video = data.video;
    currentVideo = {
      id: video._id,
      channelId: video.uploadedBy._id,
      liked: data.isLiked,
      subscribed: data.isSubscribed
    };

    const videoPlayer = document.getElementById('videoPlayer');
    document.getElementById('modalTitle').textContent = video.title;
    document.getElementById('modalViews').textContent = `${formatViews(video.views)} views`;
    document.getElementById('modalDate').textContent = `• ${formatDate(video.createdAt)}`;
    document.getElementById('modalChannel').textContent = video.uploadedBy.username;
    document.getElementById('modalChannelImg').src = video.uploadedBy.avatar;
    document.getElementById('modalDescription').textContent = video.description || 'No description.';
    document.getElementById('likeCount').textContent = video.likes?.length || 0;
    document.getElementById('modalChannelSubs').textContent =
      formatSubs(video.uploadedBy.subscriberCount);

    videoPlayer.src = `${MEDIA_BASE}${video.filePath}`;
    videoPlayer.load();

    updateLikeButton(currentVideo.liked);
    updateSubscribeButton(currentVideo.subscribed);
    await loadChannelNotificationPrefs(currentVideo.channelId, currentVideo.subscribed);
    await loadComments(videoId);

    renderRelatedVideos(video.genre, video._id);
    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  } catch {
    showNotification('Failed to load video', 'error');
  }
}

function renderRelatedVideos(genre, excludeId) {
  const related = videos.filter(v => v._id !== excludeId && (genre === 'all' || v.genre === genre)).slice(0, 6);
  const list = document.getElementById('relatedList');
  if (!related.length) {
    list.innerHTML = '<p class="no-related">No related videos yet</p>';
    return;
  }
  list.innerHTML = related.map(v => `
    <div class="related-item" data-id="${v._id}">
      <div class="related-thumb"><i class="fas fa-play"></i></div>
      <div>
        <p class="related-title">${escapeHtml(v.title)}</p>
        <p class="related-meta">${escapeHtml(v.uploadedBy?.username || '')} • ${formatViews(v.views || 0)} views</p>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.related-item').forEach(item => {
    item.addEventListener('click', () => openVideoModal(item.dataset.id));
  });
}

function closeVideoModal() {
  const videoPlayer = document.getElementById('videoPlayer');
  videoPlayer.pause();
  videoPlayer.src = '';
  videoModal.classList.remove('active');
  document.body.style.overflow = '';
  currentVideo = null;
}

function updateLikeButton(liked) {
  const btn = document.getElementById('likeBtn');
  btn.classList.toggle('active', liked);
}

function updateSubscribeButton(subscribed) {
  const btn = document.getElementById('subscribeBtn');
  const notifBtn = document.getElementById('subNotifBtn');
  btn.textContent = subscribed ? 'Subscribed' : 'Subscribe';
  btn.classList.toggle('subscribed', subscribed);
  if (notifBtn) notifBtn.style.display = subscribed ? 'inline-flex' : 'none';
}

async function loadChannelNotificationPrefs(channelId, subscribed) {
  const notifBtn = document.getElementById('subNotifBtn');
  if (!subscribed || !isLoggedIn()) return;
  try {
    const res = await fetch(`${API_BASE}/subscriptions/${channelId}/status`, { headers: getAuthHeader() });
    const data = await res.json();
    if (data.success && data.notifications) {
      channelNotifications = data.notifications;
      updateSubNotifBtn();
    }
  } catch (_) {}
}

function updateSubNotifBtn() {
  const notifBtn = document.getElementById('subNotifBtn');
  if (!notifBtn) return;
  const on = channelNotifications.uploads || channelNotifications.community;
  notifBtn.classList.toggle('active', on);
  notifBtn.title = on ? 'Notifications on — click to manage' : 'Notifications off — click to manage';
}

async function loadComments(videoId) {
  const list = document.getElementById('commentsList');
  const form = document.getElementById('commentForm');
  const hint = document.getElementById('commentLoginHint');
  try {
    const res = await fetch(`${API_BASE}/comments/video/${videoId}`, { headers: getAuthHeader() });
    const data = await res.json();
    const comments = data.comments || [];
    document.getElementById('commentCount').textContent = comments.length;
    list.innerHTML = comments.map(c => `
      <div class="comment-item ${c.pinned ? 'pinned' : ''}">
        <img src="${c.authorId?.avatar || ''}" class="comment-avatar" alt="">
        <div>
          <strong>${escapeHtml(c.authorId?.username || 'User')}</strong>
          <span class="comment-date">${formatDate(c.createdAt)}</span>
          <p>${escapeHtml(c.text)}</p>
        </div>
      </div>`).join('') || '<p class="comment-hint">No comments yet. Be the first!</p>';
    if (isLoggedIn()) {
      form.style.display = 'flex';
      hint.style.display = 'none';
    } else {
      form.style.display = 'none';
      hint.style.display = 'block';
    }
  } catch {
    list.innerHTML = '<p class="comment-hint">Could not load comments</p>';
  }
}

async function postComment(e) {
  e.preventDefault();
  if (!isLoggedIn() || !currentVideo) return showAuthRequired('comment');
  const text = document.getElementById('commentInput').value.trim();
  if (!text) return;
  try {
    const res = await fetch(`${API_BASE}/comments/video/${currentVideo.id}`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('commentInput').value = '';
      await loadComments(currentVideo.id);
    }
  } catch {
    showNotification('Failed to post comment', 'error');
  }
}

function initHeaderNotifications() {
  const wrap = document.getElementById('headerNotifWrap');
  if (!wrap || !isLoggedIn()) {
    if (wrap) wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  if (typeof initDashNotifications === 'function') {
    initDashNotifications('headerNotifWrap');
  }
}

async function toggleLike() {
  if (!isLoggedIn()) return showAuthRequired('like videos');
  if (!currentVideo) return;

  try {
    const response = await fetch(`${API_BASE}/videos/${currentVideo.id}/like`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await response.json();
    if (data.success) {
      currentVideo.liked = data.liked;
      document.getElementById('likeCount').textContent = data.likes;
      updateLikeButton(data.liked);
    }
  } catch {
    showNotification('Failed to update like', 'error');
  }
}

async function toggleSubscribe() {
  if (!isLoggedIn()) return showAuthRequired('subscribe to channels');
  if (!currentVideo?.channelId) return;

  try {
    const response = await fetch(`${API_BASE}/users/${currentVideo.channelId}/subscribe`, {
      method: 'PUT',
      headers: getAuthHeader()
    });
    const data = await response.json();
    if (data.success) {
      currentVideo.subscribed = data.subscribed;
      document.getElementById('modalChannelSubs').textContent = formatSubs(data.subscriberCount);
      updateSubscribeButton(data.subscribed);
      if (data.subscribed && data.notifications) {
        channelNotifications = data.notifications;
        updateSubNotifBtn();
      }
      showNotification(data.subscribed ? 'Subscribed!' : 'Unsubscribed', 'success');
    }
  } catch {
    showNotification('Failed to update subscription', 'error');
  }
}

async function handleUpload(e) {
  e.preventDefault();

  if (!isLoggedIn()) {
    showAuthRequired('upload videos');
    uploadModal.classList.remove('active');
    return;
  }

  const title = document.getElementById('videoTitle').value.trim();
  const description = document.getElementById('videoDescription').value;
  const genre = document.getElementById('videoGenre').value;
  const videoFile = document.getElementById('videoFile').files[0];

  if (!title || !genre || !videoFile) {
    showNotification('Please fill all required fields and select a video', 'error');
    return;
  }

  const progressBar = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const uploadProgress = document.getElementById('uploadProgress');
  const submitBtn = document.querySelector('#uploadForm .submit-btn');

  uploadProgress.style.display = 'block';
  submitBtn.disabled = true;
  progressBar.style.width = '30%';
  progressText.textContent = 'Uploading... 30%';

  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('genre', genre);

  try {
    progressBar.style.width = '60%';
    progressText.textContent = 'Uploading... 60%';

    const response = await fetch(`${API_BASE}/videos/upload`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData
    });
    const data = await response.json();

    progressBar.style.width = '100%';
    progressText.textContent = 'Uploading... 100%';

    if (data.success) {
      showNotification('Video uploaded successfully!', 'success');
      uploadModal.classList.remove('active');
      document.getElementById('uploadForm').reset();
      document.getElementById('uploadZone').classList.remove('has-file');
      document.querySelector('.upload-zone p').textContent = 'Drag and drop your video here';
      await loadVideos();
    } else {
      showNotification(data.error || 'Upload failed', 'error');
    }
  } catch {
    showNotification('Upload failed. Check server connection.', 'error');
  } finally {
    uploadProgress.style.display = 'none';
    progressBar.style.width = '0%';
    submitBtn.disabled = false;
  }
}

function updateAuthUI() {
  const userMenu = document.getElementById('userMenu');
  const signInBtn = document.getElementById('signInBtn');
  const adminLink = document.getElementById('adminLink');
  const user = getCurrentUser();

  if (user && token) {
    userMenu.style.display = 'flex';
    signInBtn.style.display = 'none';
    document.getElementById('userName').textContent = user.username;
    document.getElementById('userAvatarImg').src = user.avatar;
    if (adminLink) adminLink.style.display = user.platformRole === 'platform_admin' ? 'flex' : 'none';
    initHeaderNotifications();
    updateToolsNav();
  } else {
    userMenu.style.display = 'none';
    signInBtn.style.display = 'flex';
    if (adminLink) adminLink.style.display = 'none';
    const wrap = document.getElementById('headerNotifWrap');
    if (wrap) wrap.style.display = 'none';
    updateToolsNav();
    if (currentAppView !== 'home') closeDashboard();
  }
}

function setActiveNav(genre) {
  document.querySelectorAll('.nav-item[data-genre]').forEach(item => {
    item.classList.toggle('active', item.dataset.genre === genre);
  });
  document.querySelectorAll('.nav-item[data-app]').forEach(item => {
    item.classList.remove('active');
  });
}

function setActiveSort(sort) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === sort);
  });
}

async function loadAppConfig() {
  try {
    const res = await fetch(`${API_BASE}/config`);
    const config = await res.json();
    googleClientId = config.googleClientId || '';
    initGoogleSignIn();
  } catch {
    console.warn('Could not load app config');
  }
}

function initGoogleSignIn() {
  const hint = document.getElementById('googleHint');
  if (!googleClientId) {
    if (hint) hint.textContent = 'Add GOOGLE_CLIENT_ID to backend/.env to enable Gmail sign-in';
    return;
  }
  if (hint) hint.textContent = '';
  if (typeof google === 'undefined' || !google?.accounts?.id) return;

  try {
  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: async (response) => {
      const result = await signInWithGoogle(response.credential);
      if (result.success) {
        signInModal.classList.remove('active');
        signUpModal.classList.remove('active');
        updateAuthUI();
        showNotification(`Welcome, ${result.user.username}!`, 'success');
        await loadVideos();
        handleHashRoute();
      } else {
        showNotification(result.error, 'error');
      }
    }
  });

  ['googleSignInBtn', 'googleSignUpBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      google.accounts.id.renderButton(el, {
        theme: 'filled_black',
        size: 'large',
        width: 280,
        text: 'continue_with',
        shape: 'rectangular'
      });
    }
  });
  } catch (err) {
    console.warn('Google Sign-In init skipped:', err);
  }
}

function setupEventListeners() {
  if (!searchBtn || !searchInput || !videoGrid) {
    console.error('Critical DOM elements missing — check index.html');
    return;
  }

  // Search
  searchBtn.addEventListener('click', () => {
    currentSearch = searchInput.value.trim();
    loadVideos();
  });
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      currentSearch = searchInput.value.trim();
      loadVideos();
    }
  });

  // Genre navigation
  document.querySelectorAll('.nav-item[data-genre]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      closeDashboard();
      currentGenre = item.dataset.genre;
      setActiveNav(currentGenre);
      sidebar?.classList.remove('active');
      mobileMenu?.classList.remove('active');
      loadVideos();
    });
  });

  // Dashboard navigation (sign-in required)
  document.querySelectorAll('[data-app]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('userMenu')?.classList.remove('active');
      openDashboard(item.dataset.app);
    });
  });

  document.getElementById('backToHome')?.addEventListener('click', () => closeDashboard());
  window.addEventListener('hashchange', handleHashRoute);

  // Sort filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSort = btn.dataset.sort;
      setActiveSort(currentSort);
      if (currentView === 'home') loadVideos();
    });
  });

  // Modals
  document.getElementById('uploadBtn')?.addEventListener('click', () => {
    if (!isLoggedIn()) return showAuthRequired('upload videos');
    uploadModal?.classList.add('active');
  });
  document.getElementById('uploadModalClose')?.addEventListener('click', () => uploadModal?.classList.remove('active'));
  document.getElementById('modalClose')?.addEventListener('click', closeVideoModal);
  videoModal?.addEventListener('click', e => { if (e.target === videoModal) closeVideoModal(); });

  document.getElementById('signInBtn')?.addEventListener('click', () => signInModal?.classList.add('active'));
  document.getElementById('signInModalClose')?.addEventListener('click', () => signInModal?.classList.remove('active'));
  document.getElementById('signUpModalClose')?.addEventListener('click', () => signUpModal?.classList.remove('active'));
  document.getElementById('showSignUp')?.addEventListener('click', e => {
    e.preventDefault();
    signInModal.classList.remove('active');
    signUpModal.classList.add('active');
  });
  document.getElementById('showSignIn')?.addEventListener('click', e => {
    e.preventDefault();
    signUpModal?.classList.remove('active');
    signInModal?.classList.add('active');
  });
  document.getElementById('authRequiredSignIn')?.addEventListener('click', () => {
    authRequiredModal?.classList.remove('active');
    signInModal?.classList.add('active');
  });
  document.getElementById('authRequiredSignUp')?.addEventListener('click', () => {
    authRequiredModal?.classList.remove('active');
    signUpModal?.classList.add('active');
  });

  // User menu
  document.getElementById('userMenuTrigger')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('userMenu').classList.toggle('active');
  });
  document.addEventListener('click', e => {
    const menu = document.getElementById('userMenu');
    if (menu && !menu.contains(e.target)) menu.classList.remove('active');
  });

  document.getElementById('myVideosBtn')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('userMenu').classList.remove('active');
    closeDashboard();
    loadMyVideos();
  });
  document.getElementById('likedVideosBtn')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('userMenu').classList.remove('active');
    closeDashboard();
    loadLikedVideos();
  });
  document.getElementById('subscriptionsBtn')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('userMenu').classList.remove('active');
    closeDashboard();
    loadSubscriptionFeed();
  });
  document.getElementById('studioBtn')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('userMenu').classList.remove('active');
    openDashboard('studio');
  });
  document.getElementById('modBtn')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('userMenu').classList.remove('active');
    openDashboard('mod');
  });
  document.getElementById('adminLink')?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('userMenu').classList.remove('active');
    openDashboard('admin');
  });
  document.getElementById('logoutBtn')?.addEventListener('click', e => {
    e.preventDefault();
    signOut();
    showNotification('Signed out successfully', 'info');
  });

  // Video actions
  document.getElementById('likeBtn')?.addEventListener('click', toggleLike);
  document.getElementById('subscribeBtn')?.addEventListener('click', toggleSubscribe);
  document.getElementById('subNotifBtn')?.addEventListener('click', async () => {
    if (!currentVideo?.channelId || !currentVideo.subscribed) return;
    const panelId = 'subNotifPanel';
    let panel = document.getElementById(panelId);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = panelId;
      panel.className = 'sub-notif-panel';
      document.getElementById('subNotifBtn').after(panel);
    }
    panel.classList.toggle('open');
    panel.innerHTML = `
      <label><input type="checkbox" id="snUploads" ${channelNotifications.uploads?'checked':''}> New uploads</label>
      <label><input type="checkbox" id="snCommunity" ${channelNotifications.community?'checked':''}> Community posts</label>
      <button class="submit-btn small" id="snSave">Save</button>`;
    document.getElementById('snSave').onclick = async () => {
      const body = {
        uploads: document.getElementById('snUploads').checked,
        community: document.getElementById('snCommunity').checked
      };
      const res = await fetch(`${API_BASE}/subscriptions/${currentVideo.channelId}/notifications`, {
        method: 'PATCH',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        channelNotifications = data.notifications;
        updateSubNotifBtn();
        panel.classList.remove('open');
        showNotification('Notification preferences saved', 'success');
      }
    };
  });
  document.getElementById('commentForm')?.addEventListener('submit', postComment);
  document.querySelector('.share-btn')?.addEventListener('click', () => {
    if (currentVideo) {
      const url = `${window.location.origin}?v=${currentVideo.id}`;
      navigator.clipboard?.writeText(url);
      showNotification('Link copied to clipboard!', 'success');
    }
  });

  // Upload zone
  const uploadZone = document.getElementById('uploadZone');
  const videoFileInput = document.getElementById('videoFile');
  const mainUploadForm = document.getElementById('uploadForm');
  const browseBtn = uploadZone?.querySelector('.browse-btn');

  if (uploadZone && browseBtn && videoFileInput) {
    browseBtn.addEventListener('click', e => {
      e.stopPropagation();
      videoFileInput.click();
    });
    uploadZone.addEventListener('click', e => {
      if (e.target === browseBtn || browseBtn.contains(e.target)) return;
      videoFileInput.click();
    });
    videoFileInput.addEventListener('change', () => {
      if (videoFileInput.files[0]) {
        uploadZone.classList.add('has-file');
        const p = uploadZone.querySelector('p');
        if (p) p.textContent = videoFileInput.files[0].name;
      }
    });
    uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', e => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) {
        videoFileInput.files = e.dataTransfer.files;
        uploadZone.classList.add('has-file');
        const p = uploadZone.querySelector('p');
        if (p) p.textContent = e.dataTransfer.files[0].name;
      }
    });
  }

  mainUploadForm?.addEventListener('submit', handleUpload);

  // Mobile menu
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    sidebar?.classList.toggle('active');
    mobileMenu?.classList.add('active');
  });
  document.getElementById('mobileClose')?.addEventListener('click', () => mobileMenu?.classList.remove('active'));

  // Auth forms
  document.getElementById('signInForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value;
    const submitBtn = document.getElementById('signInSubmit');
    document.getElementById('signInPasswordError').textContent = '';

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    const result = await signIn(email, password);
    if (result.success) {
      signInModal.classList.remove('active');
      document.getElementById('signInForm').reset();
      updateAuthUI();
      showNotification(`Welcome back, ${result.user.username}!`, 'success');
      await loadVideos();
      handleHashRoute();
    } else {
      document.getElementById('signInPasswordError').textContent = result.error;
    }
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  });

  document.getElementById('signUpForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('signUpUsername').value.trim();
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPassword').value;
    const confirm = document.getElementById('signUpConfirmPassword').value;
    const submitBtn = document.getElementById('signUpSubmit');

    document.getElementById('signUpUsernameError').textContent = '';
    document.getElementById('signUpEmailError').textContent = '';
    document.getElementById('signUpConfirmError').textContent = '';

    if (password !== confirm) {
      document.getElementById('signUpConfirmError').textContent = 'Passwords do not match';
      return;
    }
    if (!isValidEmail(email)) {
      document.getElementById('signUpEmailError').textContent = 'Invalid email';
      return;
    }

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
    const result = await signUp(username, email, password);
    if (result.success) {
      signUpModal.classList.remove('active');
      document.getElementById('signUpForm').reset();
      updateAuthUI();
      showNotification(`Welcome, ${result.user.username}!`, 'success');
      await loadVideos();
      handleHashRoute();
    } else {
      const err = result.error || '';
      if (err.toLowerCase().includes('email')) {
        document.getElementById('signUpEmailError').textContent = err;
      } else {
        document.getElementById('signUpUsernameError').textContent = err;
      }
    }
    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;
  });

  // Home logo
  document.querySelector('.logo')?.addEventListener('click', e => {
    e.preventDefault();
    closeDashboard();
    currentGenre = 'all';
    currentSearch = '';
    searchInput.value = '';
    setActiveNav('all');
    loadVideos();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  getCurrentUser();

  // Bind UI immediately so buttons work even if API is slow/down
  try {
    setupEventListeners();
  } catch (err) {
    console.error('Failed to attach event listeners:', err);
  }

  (async () => {
    try {
      await loadAppConfig();
      await loadVideos();
      updateAuthUI();
      handleHashRoute();

      const params = new URLSearchParams(window.location.search);
      if (params.get('v')) openVideoModal(params.get('v'));
    } catch (err) {
      console.error('App init error:', err);
      showNotification('Some features may be limited — is the server running?', 'error');
    }
  })();
});
