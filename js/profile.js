// Profile page module
import { supabase, isSupabaseConfigured } from './supabase-config.js';
import { initAuth, onAuthChange, getUser, getProfile } from './auth.js';
import { getSavedCovers } from './social.js';
import { fetchSpotifyAlbum } from './utils.js';

// Theme
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
function setTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  themeIcon.innerHTML = dark ? '&#9788;' : '&#9789;';
  localStorage.setItem('sleeve-theme', dark ? 'dark' : 'light');
}
themeToggle.addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') !== 'dark'));
if (localStorage.getItem('sleeve-theme') === 'dark') setTheme(true);

// Tabs
document.querySelectorAll('.profile-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

async function renderCoverCard(cover, container, showStatus = false) {
  const card = document.createElement('a');
  card.className = 'profile-cover-card';
  card.href = `index.html?cover=${cover.id}`;

  let artUrl = '';
  const spotifyId = cover.spotify_id || cover.spotifyId;
  if (spotifyId) {
    try { artUrl = (await fetchSpotifyAlbum(spotifyId)).thumbnailUrl; } catch(e) {}
  }

  const title = cover.title;
  const musician = cover.musician;
  const status = cover.status;

  card.innerHTML = `
    ${artUrl ? `<img src="${artUrl}" alt="${title}">` : `<div style="width:100%;aspect-ratio:1;background:var(--bg-alt)"></div>`}
    <div class="card-title">${title}</div>
    <div class="card-artist">${musician}</div>
    ${showStatus && status ? `<span class="status-badge ${status}">${status}</span>` : ''}
  `;
  container.appendChild(card);
}

async function loadSubmissions(userId) {
  const grid = document.getElementById('submissionsGrid');
  grid.innerHTML = '';

  let data = [];
  if (!isSupabaseConfigured()) {
    try {
      data = JSON.parse(localStorage.getItem('sleeve-mock-covers') || '[]');
    } catch(e) { data = []; }
  } else {
    const result = await supabase
      .from('covers')
      .select('*')
      .eq('submitted_by', userId)
      .order('created_at', { ascending: false });
    if (!result.error) data = result.data || [];
  }

  if (data.length === 0) {
    document.getElementById('submissionsEmpty').style.display = '';
    return;
  }
  document.getElementById('submissionsEmpty').style.display = 'none';
  for (const cover of data) await renderCoverCard(cover, grid, true);
}

async function loadSaved() {
  const grid = document.getElementById('savedGrid');
  grid.innerHTML = '';

  try {
    let savedCovers = [];
    if (!isSupabaseConfigured()) {
      const savedIds = JSON.parse(localStorage.getItem('sleeve-mock-saves') || '[]');
      if (savedIds.length) {
        const { STATIC_COVERS } = await import('./data-static.js');
        const mockCovers = JSON.parse(localStorage.getItem('sleeve-mock-covers') || '[]');
        const allCovers = [...STATIC_COVERS, ...mockCovers.filter(c => c.status === 'approved')];
        savedCovers = savedIds.map(id => allCovers.find(c => c.id === id)).filter(Boolean);
      }
    } else {
      savedCovers = await getSavedCovers();
    }

    if (!savedCovers.length) {
      document.getElementById('savedEmpty').style.display = '';
      return;
    }
    document.getElementById('savedEmpty').style.display = 'none';
    for (const cover of savedCovers) await renderCoverCard(cover, grid);
  } catch (e) {
    document.getElementById('savedEmpty').style.display = '';
  }
}

// Delete account
document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
  if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    localStorage.removeItem('sleeve-mock-user');
    localStorage.removeItem('sleeve-mock-saves');
    localStorage.removeItem('sleeve-mock-covers');
    window.location.href = 'index.html';
  }
});

// Init
(async () => {
  try {
    const authTimeout = setTimeout(() => {
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('notLoggedIn').style.display = '';
    }, 5000);

    onAuthChange(async (user, profile) => {
      clearTimeout(authTimeout);
      document.getElementById('loadingState').style.display = 'none';

      if (!user) {
        document.getElementById('notLoggedIn').style.display = '';
        document.getElementById('profileContent').style.display = 'none';
        return;
      }

      document.getElementById('notLoggedIn').style.display = 'none';
      document.getElementById('profileContent').style.display = '';

      // Fill profile header
      const name = profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
      document.getElementById('profileAvatar').textContent = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
      document.getElementById('profileName').textContent = name;
      document.getElementById('profileBio').textContent = profile?.bio || '';
      document.getElementById('profileRole').textContent = profile?.role || 'user';

      // Load tab data
      try {
        await Promise.all([
          loadSubmissions(user.id),
          loadSaved()
        ]);
      } catch (e) {
        console.warn('Failed to load profile data:', e);
      }
    });

    await initAuth();
  } catch (e) {
    console.error('Profile init failed:', e);
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('notLoggedIn').style.display = '';
  }
})();
