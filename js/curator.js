// Curator panel module
import { supabase, isSupabaseConfigured } from './supabase-config.js';
import { initAuth, onAuthChange, getUser, getProfile, isCurator } from './auth.js';
import { loadPendingCovers, loadAllCovers, reviewCover, updateCover, deleteCover, loadFlags, resolveFlag, submitCover } from './covers.js';
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
document.querySelectorAll('.curator-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.curator-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ========== GENRE PICKER ==========
const AVAILABLE_GENRES = ['Rock', 'Pop', 'Hip-hop', 'R&B', 'Jazz', 'Electronic', 'Classical', 'Country', 'Folk', 'Blues', 'Metal', 'Punk', 'Indie', 'Alternative', 'Soul', 'Funk', 'Reggae', 'Latin', 'Afrobeats', 'K-pop', 'Soundtracks', 'Ambient', 'Dance'];

function renderGenrePicker(containerId, selectedGenres = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  AVAILABLE_GENRES.forEach(genre => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `genre-chip${selectedGenres.includes(genre) ? ' selected' : ''}`;
    chip.textContent = genre;
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
    container.appendChild(chip);
  });
}

function getGenrePickerValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('.genre-chip.selected')).map(c => c.textContent);
}

// ========== STATE ==========
let allCovers = [];
let artworkCache = {};

async function getArtwork(spotifyId) {
  if (!spotifyId) return '';
  if (artworkCache[spotifyId]) return artworkCache[spotifyId];
  try {
    const album = await fetchSpotifyAlbum(spotifyId);
    artworkCache[spotifyId] = album.thumbnailUrl;
    return album.thumbnailUrl;
  } catch(e) { return ''; }
}

// ========== PENDING TAB ==========
async function renderPending() {
  const grid = document.getElementById('pendingGrid');
  grid.innerHTML = '';

  const data = await loadPendingCovers();
  document.getElementById('pendingBadge').textContent = data.length || '';

  if (data.length === 0) {
    document.getElementById('pendingEmpty').style.display = '';
    return;
  }
  document.getElementById('pendingEmpty').style.display = 'none';

  for (const cover of data) {
    const spotifyId = cover.spotifyId || cover.spotify_id;
    const artUrl = await getArtwork(spotifyId);
    const coverArtist = cover.coverArtist || cover.cover_artist || '';
    const artistRole = cover.role || cover.artist_role || '';
    const genres = (cover.genre || []).join(', ');
    const curatorNote = cover.curatorNote || cover.curator_note || '';

    const card = document.createElement('div');
    card.className = 'pending-card';
    card.innerHTML = `
      ${artUrl ? `<img class="pending-card-img" src="${artUrl}" alt="${cover.title}">` : ''}
      <div class="pending-card-body">
        <div class="pending-card-title">${cover.title}</div>
        <div class="pending-card-artist">${cover.musician}</div>
        <div class="pending-card-meta">${coverArtist} · ${artistRole} · ${cover.year || 'N/A'} · ${cover.label || 'N/A'}</div>
        <div class="pending-card-meta">${genres || 'No genre'}</div>
        ${curatorNote ? `<div class="pending-card-note">"${curatorNote}"</div>` : ''}
        <div class="pending-card-actions">
          <button class="approve-btn">Approve</button>
          <button class="reject-btn">Reject</button>
        </div>
      </div>
    `;

    card.querySelector('.approve-btn').addEventListener('click', async () => {
      await reviewCover(cover.id, 'approved', getUser().id);
      card.remove();
      const remaining = grid.children.length;
      document.getElementById('pendingBadge').textContent = remaining || '';
      if (remaining === 0) document.getElementById('pendingEmpty').style.display = '';
      allCovers = await loadAllCovers();
      renderAllCovers();
    });

    card.querySelector('.reject-btn').addEventListener('click', async () => {
      await reviewCover(cover.id, 'rejected', getUser().id);
      card.remove();
      const remaining = grid.children.length;
      document.getElementById('pendingBadge').textContent = remaining || '';
      if (remaining === 0) document.getElementById('pendingEmpty').style.display = '';
      allCovers = await loadAllCovers();
      renderAllCovers();
    });

    grid.appendChild(card);
  }
}

// ========== FLAGS TAB ==========
async function renderFlags() {
  const grid = document.getElementById('flagsGrid');
  grid.innerHTML = '';

  const flags = await loadFlags();
  document.getElementById('flagsBadge').textContent = flags.length || '';

  if (flags.length === 0) {
    document.getElementById('flagsEmpty').style.display = '';
    return;
  }
  document.getElementById('flagsEmpty').style.display = 'none';

  for (const flag of flags) {
    const card = document.createElement('div');
    card.className = 'pending-card';
    card.innerHTML = `
      <div class="pending-card-body">
        <div class="pending-card-title">${flag.coverTitle}</div>
        <div class="pending-card-artist">${flag.coverMusician}</div>
        <div style="margin:0.6rem 0;"><span class="flag-type-label">${flag.type}</span></div>
        <div class="pending-card-note">"${flag.description}"</div>
        <div class="pending-card-actions">
          <button class="approve-btn flag-edit-btn">Edit Cover</button>
          <button class="reject-btn flag-dismiss-btn">Dismiss</button>
        </div>
      </div>
    `;

    card.querySelector('.flag-edit-btn').addEventListener('click', () => {
      const cover = allCovers.find(c => c.id === flag.coverId);
      if (cover) {
        openEditModal(cover);
      } else {
        alert('Cover not found. It may have been deleted.');
      }
    });

    card.querySelector('.flag-dismiss-btn').addEventListener('click', async () => {
      await resolveFlag(flag.id);
      card.remove();
      const remaining = grid.children.length;
      document.getElementById('flagsBadge').textContent = remaining || '';
      if (remaining === 0) document.getElementById('flagsEmpty').style.display = '';
    });

    grid.appendChild(card);
  }
}

// ========== ALL COVERS TAB ==========
function getFilteredCovers() {
  const search = document.getElementById('curatorSearch').value.toLowerCase();
  const genre = document.getElementById('curatorGenreFilter').value;
  const status = document.getElementById('curatorStatusFilter').value;

  return allCovers.filter(c => {
    const title = (c.title || '').toLowerCase();
    const musician = (c.musician || '').toLowerCase();
    const coverArtist = (c.coverArtist || c.cover_artist || '').toLowerCase();
    const matchSearch = !search || title.includes(search) || musician.includes(search) || coverArtist.includes(search);
    const matchGenre = !genre || (c.genre || []).includes(genre);
    const coverStatus = c.status || 'approved';
    const matchStatus = !status || coverStatus === status;
    return matchSearch && matchGenre && matchStatus;
  });
}

function renderAllCovers() {
  const tbody = document.getElementById('coverTableBody');
  tbody.innerHTML = '';

  const genreSelect = document.getElementById('curatorGenreFilter');
  const currentGenre = genreSelect.value;
  const allGenres = [...new Set(allCovers.flatMap(c => c.genre || []))].sort();
  genreSelect.innerHTML = '<option value="">All genres</option>' +
    allGenres.map(g => `<option value="${g}" ${g === currentGenre ? 'selected' : ''}>${g}</option>`).join('');

  const filtered = getFilteredCovers();
  document.getElementById('coverCount').textContent = `${filtered.length} cover${filtered.length !== 1 ? 's' : ''}`;

  if (filtered.length === 0) {
    document.getElementById('allEmpty').style.display = '';
    return;
  }
  document.getElementById('allEmpty').style.display = 'none';

  filtered.forEach(cover => {
    const tr = document.createElement('tr');
    const spotifyId = cover.spotifyId || cover.spotify_id || '';
    const coverArtist = cover.coverArtist || cover.cover_artist || '';
    const genres = (cover.genre || []).join(', ');
    const coverStatus = cover.status || 'approved';
    tr.innerHTML = `
      <td><div class="cover-table-img" data-spotify="${spotifyId}" style="background:var(--bg-alt);"></div></td>
      <td><a class="cover-table-title" href="index.html?cover=${cover.id}" target="_blank" style="color:var(--text); text-decoration:none;">${cover.title}</a></td>
      <td><span class="cover-table-artist">${cover.musician}</span></td>
      <td><span class="cover-table-artist">${coverArtist}</span></td>
      <td>${cover.year || ''}</td>
      <td><span class="cover-table-artist">${genres}</span></td>
      <td><span class="status-label ${coverStatus}">${coverStatus}</span></td>
      <td>
        <div class="cover-table-actions">
          <button class="table-btn edit-btn">Edit</button>
          <button class="table-btn danger delete-btn">Delete</button>
        </div>
      </td>
    `;

    if (spotifyId) {
      getArtwork(spotifyId).then(url => {
        if (url) {
          const imgDiv = tr.querySelector('.cover-table-img');
          imgDiv.style.backgroundImage = `url(${url})`;
          imgDiv.style.backgroundSize = 'cover';
        }
      });
    }

    tr.querySelector('.edit-btn').addEventListener('click', () => openEditModal(cover));
    tr.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(cover));

    tbody.appendChild(tr);
  });
}

// Search + filter listeners
let searchDebounce;
document.getElementById('curatorSearch').addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(renderAllCovers, 200);
});
document.getElementById('curatorGenreFilter').addEventListener('change', renderAllCovers);
document.getElementById('curatorStatusFilter').addEventListener('change', renderAllCovers);

// ========== EDIT MODAL ==========
let editingCover = null;
let isAddMode = false;

function openEditModal(cover) {
  isAddMode = false;
  editingCover = cover;
  document.querySelector('.edit-modal-header h2').textContent = 'EDIT COVER';
  document.getElementById('editSaveBtn').textContent = 'Save Changes';
  document.getElementById('editCoverId').value = cover.id;
  document.getElementById('editTitle').value = cover.title || '';
  document.getElementById('editMusician').value = cover.musician || '';
  document.getElementById('editCoverArtist').value = cover.coverArtist || cover.cover_artist || '';
  document.getElementById('editRole').value = cover.role || cover.artist_role || '';
  document.getElementById('editYear').value = cover.year || '';
  document.getElementById('editLabel').value = cover.label || '';
  renderGenrePicker('editGenrePicker', cover.genre || []);
  document.getElementById('editCuratorNote').value = cover.curatorNote || cover.curator_note || '';
  document.getElementById('editSpotifyId').value = cover.spotifyId || cover.spotify_id || '';
  const amazonFallback = `https://www.amazon.com/s?k=${encodeURIComponent(`${cover.musician} ${cover.title} vinyl`)}`;
  document.getElementById('editAmazonUrl').value = cover.amazonUrl || amazonFallback;
  const coverUrl = `${window.location.origin}/index.html?cover=${cover.id}`;
  document.getElementById('editCoverLink').href = coverUrl;
  document.getElementById('editCoverLink').textContent = coverUrl;
  document.getElementById('editCoverLinkField').style.display = '';
  document.getElementById('editSpotifyStatus').textContent = '';
  const sid = cover.spotifyId || cover.spotify_id || '';
  if (sid && artworkCache[sid]) {
    document.getElementById('editPreviewSection').style.display = '';
    document.getElementById('editPreviewThumb').src = artworkCache[sid];
    document.getElementById('editPreviewTitle').textContent = cover.title || '';
    document.getElementById('editPreviewArtist').textContent = cover.musician || '';
  } else {
    document.getElementById('editPreviewSection').style.display = 'none';
  }
  document.getElementById('editOverlay').classList.add('open');
}

function openAddModal() {
  isAddMode = true;
  editingCover = null;
  document.querySelector('.edit-modal-header h2').textContent = 'ADD COVER';
  document.getElementById('editSaveBtn').textContent = 'Add Cover';
  document.getElementById('editCoverId').value = '';
  document.getElementById('editTitle').value = '';
  document.getElementById('editMusician').value = '';
  document.getElementById('editCoverArtist').value = '';
  document.getElementById('editRole').value = '';
  document.getElementById('editYear').value = '';
  document.getElementById('editLabel').value = '';
  renderGenrePicker('editGenrePicker', []);
  document.getElementById('editCuratorNote').value = '';
  document.getElementById('editSpotifyId').value = '';
  document.getElementById('editAmazonUrl').value = '';
  document.getElementById('editCoverLinkField').style.display = 'none';
  document.getElementById('editPreviewSection').style.display = 'none';
  document.getElementById('editSpotifyStatus').textContent = '';
  document.getElementById('editOverlay').classList.add('open');
}

document.getElementById('closeEditModal').addEventListener('click', () => {
  document.getElementById('editOverlay').classList.remove('open');
});
document.getElementById('editOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) document.getElementById('editOverlay').classList.remove('open');
});

// Fetch Spotify data in edit modal
document.getElementById('editFetchSpotifyBtn').addEventListener('click', async () => {
  const input = document.getElementById('editSpotifyId').value.trim();
  const statusEl = document.getElementById('editSpotifyStatus');
  if (!input) { statusEl.textContent = 'Enter a Spotify album ID or URL.'; return; }

  const idMatch = input.match(/album[/:]([a-zA-Z0-9]+)/);
  const spotifyId = idMatch ? idMatch[1] : input;
  document.getElementById('editSpotifyId').value = spotifyId;

  statusEl.textContent = 'Fetching...';
  try {
    const album = await fetchSpotifyAlbum(spotifyId);
    statusEl.textContent = '';

    document.getElementById('editPreviewSection').style.display = '';
    document.getElementById('editPreviewThumb').src = album.thumbnailUrl || '';
    document.getElementById('editPreviewTitle').textContent = album.title || '';
    document.getElementById('editPreviewArtist').textContent = album.artist || '';

    if (!document.getElementById('editTitle').value) document.getElementById('editTitle').value = album.title || '';
    if (!document.getElementById('editMusician').value) document.getElementById('editMusician').value = album.artist || '';
    if (!document.getElementById('editYear').value && album.year) document.getElementById('editYear').value = album.year;
    if (!document.getElementById('editLabel').value && album.label) document.getElementById('editLabel').value = album.label;
  } catch(e) {
    statusEl.textContent = 'Failed to fetch album. Check the ID.';
    console.error('Spotify fetch failed:', e);
  }
});

document.getElementById('editSaveBtn').addEventListener('click', async () => {
  const coverData = {
    title: document.getElementById('editTitle').value.trim(),
    musician: document.getElementById('editMusician').value.trim(),
    coverArtist: document.getElementById('editCoverArtist').value.trim(),
    role: document.getElementById('editRole').value.trim(),
    year: parseInt(document.getElementById('editYear').value) || null,
    label: document.getElementById('editLabel').value.trim(),
    genre: getGenrePickerValues('editGenrePicker'),
    curatorNote: document.getElementById('editCuratorNote').value.trim(),
    spotifyId: document.getElementById('editSpotifyId').value.trim(),
    amazonUrl: document.getElementById('editAmazonUrl').value.trim()
  };

  if (!coverData.title || !coverData.musician) {
    alert('Title and Musician are required.');
    return;
  }

  if (isAddMode) {
    coverData.status = 'approved';
    coverData.submittedBy = getUser().id;
    if (!isSupabaseConfigured()) {
      const mockCovers = JSON.parse(localStorage.getItem('sleeve-mock-covers') || '[]');
      const maxId = Math.max(...[...allCovers, ...mockCovers].map(c => c.id || 0), 0);
      coverData.id = maxId + 1;
      coverData.hue = 0;
      coverData.sat = 0;
      coverData.lit = 25;
      mockCovers.push(coverData);
      localStorage.setItem('sleeve-mock-covers', JSON.stringify(mockCovers));
    } else {
      await submitCover(coverData);
    }
  } else {
    await updateCover(editingCover.id, coverData);
  }

  document.getElementById('editOverlay').classList.remove('open');
  allCovers = await loadAllCovers();
  renderAllCovers();
});

// Add Cover button
document.getElementById('addCoverBtn').addEventListener('click', openAddModal);

// ========== DELETE MODAL ==========
let deletingCover = null;

function openDeleteModal(cover) {
  deletingCover = cover;
  document.getElementById('deleteTitle').textContent = `"${cover.title}" by ${cover.musician}`;
  document.getElementById('deleteOverlay').classList.add('open');
}

document.getElementById('closeDeleteModal').addEventListener('click', () => {
  document.getElementById('deleteOverlay').classList.remove('open');
});
document.getElementById('deleteOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) document.getElementById('deleteOverlay').classList.remove('open');
});
document.getElementById('deleteCancelBtn').addEventListener('click', () => {
  document.getElementById('deleteOverlay').classList.remove('open');
});
document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
  if (!deletingCover) return;
  await deleteCover(deletingCover.id);
  document.getElementById('deleteOverlay').classList.remove('open');
  allCovers = await loadAllCovers();
  renderAllCovers();
});

// ========== INIT ==========
(async () => {
  try {
    const authTimeout = setTimeout(() => {
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('accessDenied').style.display = '';
    }, 5000);

    onAuthChange(async (user, profile) => {
      clearTimeout(authTimeout);
      document.getElementById('loadingState').style.display = 'none';

      if (!user || !isCurator()) {
        document.getElementById('accessDenied').style.display = '';
        document.getElementById('curatorContent').style.display = 'none';
        return;
      }

      document.getElementById('accessDenied').style.display = 'none';
      document.getElementById('curatorContent').style.display = '';

      // Load data
      allCovers = await loadAllCovers();
      await renderPending();
      await renderFlags();
      renderAllCovers();
    });

    await initAuth();
  } catch(e) {
    console.error('Curator init failed:', e);
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('accessDenied').style.display = '';
  }
})();
