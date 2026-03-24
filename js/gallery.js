// Main gallery module — rendering, filtering, vinyl animation, interactions
import { loadCovers, submitCover, submitFlag } from './covers.js';
import { initAuth, onAuthChange, getUser, getProfile, signInWithEmail, signUpWithEmail, signOut, isCurator, setMockUser, getMockUserType } from './auth.js';
import { loadSavedCovers, toggleSave, isSaved } from './social.js';
import { coverImages, initPlaceholders, fetchRealArtwork, extractSpotifyId, fetchSpotifyAlbum } from './utils.js';
import { isSupabaseConfigured } from './supabase-config.js';
import { initI18n } from './i18n.js';

// ========== STATE ==========
let covers = [];
let currentCover = null;
let currentGenre = 'All';
let currentDecade = 'All';
let currentRole = 'All';
let searchQuery = '';
let touchStartX = 0;
let animating = false;
let searchDebounce = null;
let allGenres = ['All'];
let allDecades = ['All'];
let allRoles = ['All'];

// ========== FILTER LOGIC ==========
function getFilteredCovers() {
  let result = covers;
  if (currentGenre !== 'All') result = result.filter(c => c.genre.includes(currentGenre));
  if (currentDecade !== 'All') {
    const decadeStart = parseInt(currentDecade);
    result = result.filter(c => c.year >= decadeStart && c.year < decadeStart + 10);
  }
  if (currentRole !== 'All') result = result.filter(c => c.role === currentRole);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.musician.toLowerCase().includes(q) ||
      c.coverArtist.toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q) ||
      c.genre.some(g => g.toLowerCase().includes(q))
    );
  }
  return result;
}

function getCountFor(dimension, value) {
  const tempGenre = dimension === 'genre' ? value : currentGenre;
  const tempDecade = dimension === 'decade' ? value : currentDecade;
  const tempRole = dimension === 'role' ? value : currentRole;
  let result = covers;
  if (tempGenre !== 'All') result = result.filter(c => c.genre.includes(tempGenre));
  if (tempDecade !== 'All') {
    const ds = parseInt(tempDecade);
    result = result.filter(c => c.year >= ds && c.year < ds + 10);
  }
  if (tempRole !== 'All') result = result.filter(c => c.role === tempRole);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(c =>
      c.title.toLowerCase().includes(q) || c.musician.toLowerCase().includes(q) ||
      c.coverArtist.toLowerCase().includes(q) || c.label.toLowerCase().includes(q) ||
      c.genre.some(g => g.toLowerCase().includes(q))
    );
  }
  return result.length;
}

function applyFilters() {
  renderAllFilterLists();
  renderActiveChips();
  renderGrids();
  renderThumbs();
}

function clearAllFilters() {
  currentGenre = 'All';
  currentDecade = 'All';
  currentRole = 'All';
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('mobileSearchInput').value = '';
  document.getElementById('searchClear').classList.remove('visible');
  document.getElementById('mobileSearchClear').classList.remove('visible');
  applyFilters();
}

function hasActiveFilters() {
  return currentGenre !== 'All' || currentDecade !== 'All' || currentRole !== 'All' || searchQuery !== '';
}

// ========== RENDER FUNCTIONS ==========

function renderFilterList(containerId, items, currentValue, dimension) {
  const list = document.getElementById(containerId);
  if (!list) return;
  list.innerHTML = '';
  items.forEach(value => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    const count = getCountFor(dimension, value);
    btn.className = `filter-btn sans${value === currentValue ? ' active' : ''}`;
    btn.innerHTML = `${value} <span class="count">${count}</span>`;
    btn.setAttribute('aria-pressed', value === currentValue);
    btn.addEventListener('click', () => {
      if (dimension === 'genre') currentGenre = value;
      else if (dimension === 'decade') currentDecade = value;
      else if (dimension === 'role') currentRole = value;
      applyFilters();
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function renderAllFilterLists() {
  renderFilterList('filterList', allGenres, currentGenre, 'genre');
  renderFilterList('mobileFilterList', allGenres, currentGenre, 'genre');
  renderFilterList('decadeFilterList', allDecades, currentDecade, 'decade');
  renderFilterList('mobileDecadeFilterList', allDecades, currentDecade, 'decade');
  renderFilterList('roleFilterList', allRoles, currentRole, 'role');
  renderFilterList('mobileRoleFilterList', allRoles, currentRole, 'role');
}

function renderActiveChips() {
  ['activeFilters', 'mobileActiveFilters'].forEach(containerId => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!hasActiveFilters()) return;

    if (searchQuery) {
      const chip = document.createElement('button');
      chip.className = 'active-chip';
      chip.innerHTML = `"${searchQuery}" <span class="chip-x">&times;</span>`;
      chip.addEventListener('click', () => {
        searchQuery = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('mobileSearchInput').value = '';
        document.getElementById('searchClear').classList.remove('visible');
        document.getElementById('mobileSearchClear').classList.remove('visible');
        applyFilters();
      });
      container.appendChild(chip);
    }
    if (currentGenre !== 'All') {
      const chip = document.createElement('button');
      chip.className = 'active-chip';
      chip.innerHTML = `${currentGenre} <span class="chip-x">&times;</span>`;
      chip.addEventListener('click', () => { currentGenre = 'All'; applyFilters(); });
      container.appendChild(chip);
    }
    if (currentDecade !== 'All') {
      const chip = document.createElement('button');
      chip.className = 'active-chip';
      chip.innerHTML = `${currentDecade} <span class="chip-x">&times;</span>`;
      chip.addEventListener('click', () => { currentDecade = 'All'; applyFilters(); });
      container.appendChild(chip);
    }
    if (currentRole !== 'All') {
      const chip = document.createElement('button');
      chip.className = 'active-chip';
      chip.innerHTML = `${currentRole} <span class="chip-x">&times;</span>`;
      chip.addEventListener('click', () => { currentRole = 'All'; applyFilters(); });
      container.appendChild(chip);
    }

    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-all-btn';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', clearAllFilters);
    container.appendChild(clearBtn);
  });

  const count = (currentGenre !== 'All' ? 1 : 0) + (currentDecade !== 'All' ? 1 : 0) +
                (currentRole !== 'All' ? 1 : 0) + (searchQuery ? 1 : 0);
  const badge = document.getElementById('filterBadge');
  if (badge) badge.textContent = count > 0 ? count : '';
}

function renderGrids() {
  const container = document.getElementById('coverGrids');
  if (!container) return;
  container.innerHTML = '';

  const filtered = getFilteredCovers();

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="no-results sans">
        <div class="no-results-icon" aria-hidden="true">&#9835;</div>
        <p>No covers match your current filters.</p>
      </div>
    `;
    return;
  }

  const genreGroups = {};
  filtered.forEach(c => {
    c.genre.forEach(g => {
      if (!genreGroups[g]) genreGroups[g] = [];
      if (!genreGroups[g].find(x => x.id === c.id)) genreGroups[g].push(c);
    });
  });

  if (currentGenre !== 'All') {
    container.appendChild(createGridSection(currentGenre, genreGroups[currentGenre] || filtered));
  } else {
    for (const genre of allGenres.filter(g => g !== 'All')) {
      if (genreGroups[genre] && genreGroups[genre].length) {
        container.appendChild(createGridSection(genre, genreGroups[genre]));
      }
    }
  }
}

function createGridSection(genreName, items) {
  const section = document.createElement('div');
  section.className = 'cover-grid-section';
  section.innerHTML = `<h2>${genreName}</h2>`;

  const grid = document.createElement('div');
  grid.className = 'cover-grid';
  grid.setAttribute('role', 'list');

  items.forEach(cover => {
    const card = document.createElement('button');
    card.className = 'grid-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `${cover.title} by ${cover.musician}, cover by ${cover.coverArtist}`);
    card.innerHTML = `
      <img src="${coverImages[cover.id]}" alt="${cover.title} — ${cover.musician}" loading="lazy" data-cover-id="${cover.id}">
      <div class="grid-card-title sans">${cover.title}</div>
      <div class="grid-card-artist sans">${cover.musician}</div>
    `;
    card.addEventListener('click', () => selectCover(cover));
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

function renderThumbs() {
  const list = document.getElementById('thumbList');
  if (!list) return;
  list.innerHTML = '';
  const filtered = getFilteredCovers();

  filtered.forEach(cover => {
    const btn = document.createElement('button');
    btn.className = `thumb-btn${cover.id === currentCover.id ? ' active' : ''}`;
    btn.setAttribute('aria-label', `View ${cover.title} by ${cover.musician}`);
    btn.innerHTML = `<img src="${coverImages[cover.id]}" alt="${cover.title}" loading="lazy" data-cover-id="${cover.id}">`;
    btn.addEventListener('click', () => selectCover(cover));
    list.appendChild(btn);
  });
}

function updateMeta(cover) {
  document.getElementById('metaTitle').textContent = cover.title;
  document.getElementById('metaMusician').textContent = cover.musician;

  const badgesEl = document.getElementById('creditBadges');
  badgesEl.innerHTML = '';
  const contributors = (cover.contributors && cover.contributors.length)
    ? cover.contributors
    : [{ name: cover.coverArtist, role: cover.role }];
  contributors.forEach(c => {
    const badge = document.createElement('div');
    badge.className = 'credit-badge';
    badge.innerHTML = `<span class="role-tag">${c.role}</span><span>${c.name}</span>`;
    badgesEl.appendChild(badge);
  });

  document.getElementById('metaYearLabel').textContent = `${cover.year} · ${cover.label}`;
  document.getElementById('curatorNote').textContent = cover.curatorNote;

  // Spotify embed
  const spotifyEl = document.getElementById('spotifyEmbed');
  if (cover.spotifyId) {
    spotifyEl.innerHTML = `<iframe src="https://open.spotify.com/embed/album/${cover.spotifyId}?utm_source=generator&theme=0" height="380" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
  } else {
    spotifyEl.innerHTML = '';
  }

  // Amazon vinyl link
  const vinylBtn = document.getElementById('buyVinylBtn');
  const vinylText = vinylBtn.querySelector('[data-i18n]');
  const vinylIcon = vinylBtn.querySelector('svg');
  if (cover.submittedBy && !cover.amazonUrl) {
    if (vinylText) vinylText.textContent = 'Check vinyl availability';
    if (vinylIcon) vinylIcon.style.display = 'none';
    vinylBtn.classList.add('vinyl-hint');
  } else {
    if (vinylText) vinylText.textContent = 'Buy Vinyl';
    if (vinylIcon) vinylIcon.style.display = '';
    vinylBtn.classList.remove('vinyl-hint');
  }
  if (cover.amazonUrl) {
    vinylBtn.href = cover.amazonUrl;
  } else {
    const amazonQuery = encodeURIComponent(`${cover.musician} ${cover.title} vinyl`);
    vinylBtn.href = `https://www.amazon.com/s?k=${amazonQuery}`;
  }

  // Save button
  updateSaveButton(cover);

  // Flag button — show only for logged-in non-curator users
  const flagBtn = document.getElementById('flagMistakeBtn');
  if (flagBtn) {
    const user = getUser();
    flagBtn.style.display = (user && !isCurator()) ? '' : 'none';
  }

  // Tags
  const tags = document.getElementById('metaTags');
  tags.innerHTML = '';
  cover.genre.forEach(g => {
    const span = document.createElement('span');
    span.className = 'tag sans';
    span.textContent = g;
    tags.appendChild(span);
  });
}

function updateSaveButton(cover) {
  const saveBtn = document.getElementById('saveCoverBtn');
  if (!saveBtn) return;
  const saved = getUser() ? isSaved(cover.id) : false;
  saveBtn.classList.toggle('saved', saved);
}

// ========== VINYL ANIMATION ==========
function selectCover(cover) {
  if (cover.id === currentCover.id || animating) return;
  animating = true;
  currentCover = cover;

  const disc = document.getElementById('vinylDisc');
  const img = document.getElementById('featuredImg');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setFeaturedImage() {
    img.src = coverImages[cover.id];
    img.alt = `${cover.title} by ${cover.musician}, cover art by ${cover.coverArtist}`;
    img.setAttribute('data-cover-id', cover.id);
  }

  if (reducedMotion) {
    img.style.opacity = '0';
    setTimeout(() => {
      setFeaturedImage();
      img.style.opacity = '1';
      animating = false;
    }, 300);
  } else {
    disc.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
    disc.classList.add('slide-out');
    setTimeout(() => {
      disc.style.transition = 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
      disc.classList.remove('slide-out');
      disc.classList.add('spinning');
      setTimeout(() => { setFeaturedImage(); }, 200);
      setTimeout(() => {
        disc.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        disc.classList.remove('spinning');
        disc.classList.add('slide-in');
        setTimeout(() => {
          disc.classList.remove('slide-in');
          disc.style.transform = '';
          animating = false;
        }, 500);
      }, 800);
    }, 500);
  }

  updateMeta(cover);
  renderThumbs();
}

// ========== SWIPE SUPPORT ==========
function initSwipe() {
  document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 60) {
      const filtered = getFilteredCovers();
      const idx = filtered.findIndex(c => c.id === currentCover.id);
      if (diff < 0 && idx < filtered.length - 1) selectCover(filtered[idx + 1]);
      else if (diff > 0 && idx > 0) selectCover(filtered[idx - 1]);
    }
  }, { passive: true });
}

// ========== KEYBOARD NAV ==========
function initKeyboardNav() {
  document.addEventListener('keydown', e => {
    if (document.getElementById('submitOverlay')?.classList.contains('open')) return;
    if (document.getElementById('authModal')?.classList.contains('open')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const filtered = getFilteredCovers();
      const idx = filtered.findIndex(c => c.id === currentCover.id);
      if (e.key === 'ArrowLeft' && idx > 0) selectCover(filtered[idx - 1]);
      else if (e.key === 'ArrowRight' && idx < filtered.length - 1) selectCover(filtered[idx + 1]);
    }
  });
}

// ========== THEME TOGGLE ==========
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  function setTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    themeIcon.innerHTML = dark ? '&#9788;' : '&#9789;';
    localStorage.setItem('sleeve-theme', dark ? 'dark' : 'light');
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(!isDark);
  });

  if (localStorage.getItem('sleeve-theme') === 'dark') setTheme(true);
}

// ========== SEARCH ==========
function initSearch() {
  function setupSearch(inputId, clearId) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(clearId);
    if (!input || !clearBtn) return;

    input.addEventListener('input', () => {
      clearBtn.classList.toggle('visible', input.value.length > 0);
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchQuery = input.value.trim();
        document.getElementById('searchInput').value = searchQuery;
        document.getElementById('mobileSearchInput').value = searchQuery;
        applyFilters();
      }, 200);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('visible');
      searchQuery = '';
      document.getElementById('searchInput').value = '';
      document.getElementById('mobileSearchInput').value = '';
      applyFilters();
      input.focus();
    });
  }

  setupSearch('searchInput', 'searchClear');
  setupSearch('mobileSearchInput', 'mobileSearchClear');
}

// ========== FILTER OVERLAY ==========
function initFilterOverlay() {
  document.getElementById('openFilters')?.addEventListener('click', () => {
    document.getElementById('filterOverlay').classList.add('open');
  });
  document.getElementById('closeFilters')?.addEventListener('click', () => {
    document.getElementById('filterOverlay').classList.remove('open');
  });
}

// ========== BURGER MENU ==========
function initBurgerMenu() {
  const overlay = document.getElementById('mobileMenuOverlay');
  const burgerBtn = document.getElementById('burgerBtn');
  if (!overlay || !burgerBtn) return;

  function openMenu() { overlay.classList.add('open'); }
  function closeMenu() { overlay.classList.remove('open'); }

  burgerBtn.addEventListener('click', openMenu);
  document.getElementById('closeMobileMenu')?.addEventListener('click', closeMenu);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeMenu(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeMenu();
  });

  // Submit a Cover
  document.getElementById('mobileSubmitCover')?.addEventListener('click', () => {
    closeMenu();
    document.getElementById('openSubmitModal')?.click();
  });

  // Filters
  document.getElementById('mobileFilters')?.addEventListener('click', () => {
    closeMenu();
    document.getElementById('openFilters')?.click();
  });

  // Dark mode toggle
  const mobileThemeBtn = document.getElementById('mobileThemeToggle');
  const mobileThemeIcon = document.getElementById('mobileThemeIcon');
  mobileThemeBtn?.addEventListener('click', () => {
    document.getElementById('themeToggle')?.click();
    // Sync icon
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (mobileThemeIcon) mobileThemeIcon.innerHTML = isDark ? '&#9788;' : '&#9789;';
  });

  // Sign In
  document.getElementById('mobileSignIn')?.addEventListener('click', () => {
    closeMenu();
    document.getElementById('loginBtn')?.click();
  });

  // Sync sign-in visibility with auth state
  onAuthChange((user) => {
    const signInItem = document.getElementById('mobileSignIn');
    if (signInItem) signInItem.style.display = user ? 'none' : '';
  });

  // Sync theme icon on init
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (mobileThemeIcon) mobileThemeIcon.innerHTML = isDark ? '&#9788;' : '&#9789;';
}

// ========== AUTH UI ==========
function initAuthUI() {
  // Auth modal
  const authModal = document.getElementById('authModal');
  const loginBtn = document.getElementById('loginBtn');
  const userMenu = document.getElementById('userMenu');

  if (!authModal) return;

  // Open auth modal
  loginBtn?.addEventListener('click', () => {
    authModal.classList.add('open');
  });

  // Close auth modal
  document.getElementById('closeAuthModal')?.addEventListener('click', () => {
    authModal.classList.remove('open');
  });
  authModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) authModal.classList.remove('open');
  });

  // Auth mode toggle (sign in / sign up)
  let isSignUpMode = false;
  const authToggleBtn = document.getElementById('authToggleBtn');
  const authToggleMsg = document.getElementById('authToggleMsg');
  const signupFields = document.getElementById('signupFields');
  const authTitle = document.getElementById('authModalTitle');
  const authSubtitle = document.getElementById('authSubtitle');
  const emailSignInBtn = document.getElementById('emailSignIn');

  function setAuthMode(signUp) {
    isSignUpMode = signUp;
    signupFields.style.display = signUp ? '' : 'none';
    emailSignInBtn.textContent = signUp ? 'Sign Up' : 'Sign In';
    authTitle.textContent = signUp ? 'Sign Up' : 'Sign In';
    authSubtitle.textContent = signUp
      ? 'Create an account to submit covers, save favorites, and more.'
      : 'Sign in to submit covers, save favorites, and connect with other collectors.';
    authToggleMsg.textContent = signUp ? 'Already have an account?' : "Don't have an account?";
    authToggleBtn.textContent = signUp ? 'Sign In' : 'Sign Up';
    document.getElementById('authError').textContent = '';
  }

  authToggleBtn?.addEventListener('click', () => setAuthMode(!isSignUpMode));

  // Email sign in / sign up
  emailSignInBtn?.addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    errorEl.textContent = '';

    if (isSignUpMode) {
      const firstName = document.getElementById('authFirstName').value.trim();
      const lastName = document.getElementById('authLastName').value.trim();
      if (!firstName || !lastName) { errorEl.textContent = 'Enter your first and last name.'; return; }
      if (!email || !password) { errorEl.textContent = 'Enter email and password.'; return; }
      if (password.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; return; }
      try {
        await signUpWithEmail(email, password, firstName, lastName);
        errorEl.style.color = 'var(--text-muted)';
        errorEl.textContent = 'Account created! You can now sign in.';
        setTimeout(() => { setAuthMode(false); errorEl.style.color = ''; }, 2000);
      } catch (e) {
        errorEl.textContent = e.message;
      }
    } else {
      if (!email || !password) { errorEl.textContent = 'Enter email and password.'; return; }
      try {
        await signInWithEmail(email, password);
      } catch (e) {
        errorEl.textContent = e.message;
      }
    }
  });

  // Enter key in password field triggers action
  document.getElementById('authPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') emailSignInBtn?.click();
  });

  // Sign out
  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    try {
      await signOut();
      userMenu.classList.remove('open');
    } catch (e) { console.error('Sign-out failed:', e); }
  });

  // User avatar dropdown
  document.getElementById('userAvatar')?.addEventListener('click', () => {
    userMenu.classList.toggle('open');
  });

  // Close dropdown on click outside
  document.addEventListener('click', e => {
    if (userMenu && !userMenu.contains(e.target) && !document.getElementById('userAvatar')?.contains(e.target)) {
      userMenu.classList.remove('open');
    }
  });

  // Update UI on auth change
  onAuthChange((user, profile) => {
    if (user && profile) {
      loginBtn.style.display = 'none';
      document.getElementById('userAvatarWrap').style.display = '';
      const avatarBtn = document.getElementById('userAvatar');
      const avatarImg = document.getElementById('userAvatarImg');
      const initials = (profile.display_name || 'U')[0].toUpperCase();
      if (profile.avatar_url) {
        avatarImg.src = profile.avatar_url;
        avatarImg.style.display = '';
        avatarBtn.textContent = '';
        avatarBtn.appendChild(avatarImg);
      } else {
        avatarImg.style.display = 'none';
        avatarBtn.textContent = initials;
      }
      document.getElementById('userDisplayName').textContent = profile.display_name || 'User';

      // Show curator link if applicable
      const curatorLink = document.getElementById('curatorPanelLink');
      if (curatorLink) curatorLink.style.display = isCurator() ? '' : 'none';

      // Load saved covers
      loadSavedCovers().then(() => {
        if (currentCover) updateSaveButton(currentCover);
      });

      // Update flag button visibility
      const flagBtn = document.getElementById('flagMistakeBtn');
      if (flagBtn) flagBtn.style.display = isCurator() ? 'none' : '';

      authModal.classList.remove('open');
    } else {
      loginBtn.style.display = '';
      document.getElementById('userAvatarWrap').style.display = 'none';
      // Hide flag button when logged out
      const flagBtn = document.getElementById('flagMistakeBtn');
      if (flagBtn) flagBtn.style.display = 'none';
    }

    // Sync dev toolbar active state
    document.querySelectorAll('.dev-toolbar-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mock === getMockUserType());
    });
  });
}

// ========== SAVE BUTTON ==========
function initSaveButton() {
  const saveBtn = document.getElementById('saveCoverBtn');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const user = getUser();
    if (!user) {
      document.getElementById('authModal')?.classList.add('open');
      return;
    }
    try {
      await toggleSave(currentCover.id);
      updateSaveButton(currentCover);
    } catch (e) {
      console.error('Save failed:', e);
    }
  });
}

// ========== FLAG MODAL ==========
function initFlagModal() {
  const overlay = document.getElementById('flagOverlay');
  const flagBtn = document.getElementById('flagMistakeBtn');
  if (!overlay || !flagBtn) return;

  function openFlagModal() {
    const user = getUser();
    if (!user) {
      document.getElementById('authModal')?.classList.add('open');
      return;
    }
    if (!currentCover) return;
    // Populate cover info
    document.getElementById('flagCoverInfo').innerHTML =
      `<div class="flag-cover-title">${currentCover.title}</div><div class="flag-cover-artist">${currentCover.musician}</div>`;
    // Reset form
    document.getElementById('flagTypeSelect').value = '';
    document.getElementById('flagDescription').value = '';
    document.getElementById('flagErrors').textContent = '';
    document.getElementById('flagSuccess').classList.remove('show');
    document.getElementById('submitFlagBtn').style.display = '';
    // Show form fields
    overlay.querySelectorAll('.form-group').forEach(g => g.style.display = '');
    overlay.classList.add('open');
  }

  function closeFlagModal() {
    overlay.classList.remove('open');
  }

  flagBtn.addEventListener('click', openFlagModal);
  document.getElementById('closeFlagModal').addEventListener('click', closeFlagModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeFlagModal(); });

  document.getElementById('submitFlagBtn').addEventListener('click', async () => {
    const type = document.getElementById('flagTypeSelect').value;
    const description = document.getElementById('flagDescription').value.trim();
    const errEl = document.getElementById('flagErrors');

    if (!type) { errEl.textContent = 'Please select a type of issue.'; return; }
    if (!description) { errEl.textContent = 'Please describe the issue.'; return; }
    errEl.textContent = '';

    try {
      await submitFlag({
        coverId: currentCover.id,
        coverTitle: currentCover.title,
        coverMusician: currentCover.musician,
        type,
        description,
        submittedBy: getUser().id
      });
      document.getElementById('submitFlagBtn').style.display = 'none';
      // Hide form fields, show success
      overlay.querySelectorAll('.form-group').forEach(g => g.style.display = 'none');
      document.getElementById('flagSuccess').classList.add('show');
    } catch (e) {
      errEl.textContent = 'Something went wrong. Please try again.';
      console.error('Flag submit failed:', e);
    }
  });
}

// ========== SUBMIT MODAL ==========
function initSubmitModal() {
  const overlay = document.getElementById('submitOverlay');
  if (!overlay) return;

  function openSubmitModal() {
    const user = getUser();
    if (!user) {
      document.getElementById('authModal')?.classList.add('open');
      return;
    }
    renderGenrePicker('genrePicker', []);
    overlay.classList.add('open');
    document.getElementById('spotifyUrlInput')?.focus();
  }

  function closeSubmitModal() {
    overlay.classList.remove('open');
    resetSubmitForm();
  }

  function resetSubmitForm() {
    overlay.removeAttribute('data-spotify-id');
    overlay.removeAttribute('data-artwork-url');
    overlay.removeAttribute('data-album-title');
    document.getElementById('spotifyUrlInput').value = '';
    document.getElementById('musicianInput').value = '';
    document.getElementById('yearInput').value = '';
    document.getElementById('labelInput').value = '';
    renderGenrePicker('genrePicker', []);
    document.getElementById('curatorNoteInput').value = '';
    document.getElementById('submitErrors').innerHTML = '';
    document.getElementById('spotifyStatus').textContent = '';
    document.getElementById('spotifyStatus').className = 'spotify-status';
    document.getElementById('autoFilledSection').style.display = 'none';
    document.querySelector('.submit-modal-body').style.display = '';
    const successEl = document.getElementById('submitSuccess');
    if (successEl) { successEl.style.display = 'none'; successEl.classList.remove('show'); }

    const list = document.getElementById('contributorsList');
    list.innerHTML = '';
    list.appendChild(createContributorRow());
  }

  // Open / close
  document.getElementById('openSubmitModal')?.addEventListener('click', openSubmitModal);
  document.getElementById('closeSubmitModal')?.addEventListener('click', closeSubmitModal);

  // ESC / click outside
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeSubmitModal();
  });
  overlay.addEventListener('click', e => { if (e.target === e.currentTarget) closeSubmitModal(); });

  // Focus trap
  overlay.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const modal = document.querySelector('.submit-modal');
    const focusable = modal.querySelectorAll('input, select, textarea, button, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // Spotify fetch
  document.getElementById('fetchSpotifyBtn')?.addEventListener('click', async () => {
    const input = document.getElementById('spotifyUrlInput').value;
    const statusEl = document.getElementById('spotifyStatus');
    const autoSection = document.getElementById('autoFilledSection');
    const fetchBtn = document.getElementById('fetchSpotifyBtn');

    const spotifyId = extractSpotifyId(input);
    if (!spotifyId) {
      statusEl.textContent = 'Paste a Spotify album link or 22-character ID.';
      statusEl.className = 'spotify-status error';
      return;
    }

    statusEl.textContent = 'Fetching album data...';
    statusEl.className = 'spotify-status';
    fetchBtn.disabled = true;

    try {
      const data = await fetchSpotifyAlbum(spotifyId);
      overlay.dataset.spotifyId = spotifyId;
      overlay.dataset.artworkUrl = data.thumbnailUrl;
      overlay.dataset.albumTitle = data.title;

      document.getElementById('previewThumb').src = data.thumbnailUrl;
      document.getElementById('previewTitle').textContent = data.title;
      document.getElementById('previewSubtitle').textContent = `Spotify ID: ${spotifyId}`;

      autoSection.style.display = 'block';
      statusEl.textContent = 'Album found. Fill in the details below.';
      statusEl.className = 'spotify-status success';
    } catch (e) {
      statusEl.textContent = 'Could not fetch album. Check the URL and try again.';
      statusEl.className = 'spotify-status error';
      autoSection.style.display = 'none';
    } finally {
      fetchBtn.disabled = false;
    }
  });

  // Auto-fetch on paste
  document.getElementById('spotifyUrlInput')?.addEventListener('paste', () => {
    setTimeout(() => document.getElementById('fetchSpotifyBtn').click(), 150);
  });

  // Submit handler — now posts to Supabase instead of GitHub Issues
  document.getElementById('submitToGithub')?.addEventListener('click', async () => {
    const errorsEl = document.getElementById('submitErrors');
    const errors = [];

    if (!overlay.dataset.spotifyId) errors.push('Fetch a Spotify album first.');
    const musician = document.getElementById('musicianInput').value.trim();
    if (!musician) errors.push('Musician / Band is required.');
    const contributors = getContributors();
    if (!contributors.length) errors.push('Add at least one contributor.');
    const missingRoles = contributors.filter(c => !c.role);
    if (missingRoles.length) errors.push('Select a role for each contributor.');

    if (errors.length) {
      errorsEl.innerHTML = errors.map(e => `<div>${e}</div>`).join('');
      return;
    }
    errorsEl.innerHTML = '';

    const albumTitle = overlay.dataset.albumTitle || '';
    const spotifyId = overlay.dataset.spotifyId;
    const year = document.getElementById('yearInput').value || '';
    const label = document.getElementById('labelInput').value.trim();
    const genres = getGenrePickerValues('genrePicker');
    const curatorNote = document.getElementById('curatorNoteInput').value.trim();

    const coverData = {
      title: albumTitle,
      musician: musician,
      coverArtist: contributors[0].name,
      role: contributors[0].role,
      contributors: contributors.length > 1 ? contributors : [],
      year: year ? parseInt(year) : null,
      label: label || '',
      genre: genres.length ? genres : ['TBD'],
      curatorNote: curatorNote || '',
      spotifyId: spotifyId,
      hue: 0, sat: 0, lit: 25
    };

    const user = getUser();

    if (user) {
      // Submit to Supabase or mock localStorage
      try {
        coverData.submittedBy = user.id;
        await submitCover(coverData);
      } catch (e) {
        errorsEl.innerHTML = `<div>Submission failed: ${e.message}</div>`;
        return;
      }
    } else {
      // Fallback: GitHub Issues
      const GITHUB_REPO_URL = 'https://github.com/mvrivzs/sleeve-gallery';
      const entry = {
        title: albumTitle, musician, coverArtist: contributors[0].name,
        role: contributors[0].role,
        ...(contributors.length > 1 ? { contributors } : {}),
        year: year ? parseInt(year) : 'TBD',
        label: label || 'TBD', genre: genres.length ? genres : ['TBD'],
        curatorNote: curatorNote || '', spotifyId, hue: 0, sat: 0, lit: 25
      };
      const jsonBlock = JSON.stringify(entry, null, 2);
      const contributorLines = contributors.map(c => `| **${c.role}** | ${c.name} |`).join('\n');
      const title = `New Cover: ${albumTitle} — ${musician}`;
      const body = `## New Cover Submission\n\n| Field | Value |\n|---|---|\n| **Album** | ${albumTitle} |\n| **Musician** | ${musician} |\n${contributorLines}\n| **Year** | ${year || 'N/A'} |\n| **Label** | ${label || 'N/A'} |\n| **Genre** | ${genres.join(', ') || 'N/A'} |\n| **Curator Note** | ${curatorNote || 'N/A'} |\n\n**Spotify**: https://open.spotify.com/album/${spotifyId}\n\n### JSON Entry\n\n\`\`\`json\n${jsonBlock}\n\`\`\`\n\n---\n*Submitted via Sleeve gallery*`;
      const issueUrl = `${GITHUB_REPO_URL}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=cover-submission`;
      window.open(issueUrl, '_blank', 'noopener,noreferrer');
    }

    // Show success
    document.querySelector('.submit-modal-body').style.display = 'none';
    const successEl = document.getElementById('submitSuccess');
    successEl.style.display = 'block';
    const modal = document.querySelector('.submit-modal');
    modal.appendChild(successEl);
    successEl.classList.add('show');
  });

  // Contributors
  document.getElementById('addContributorBtn')?.addEventListener('click', () => {
    document.getElementById('contributorsList').appendChild(createContributorRow());
  });
  initContributors();
}

function createContributorRow() {
  const row = document.createElement('div');
  row.className = 'contributor-row';
  row.innerHTML = `
    <input type="text" class="submit-input contributor-name" data-field="name" placeholder="Artist name">
    <select class="submit-input contributor-role" data-field="role">
      <option value="">Role...</option>
      <option value="Illustration">Illustration</option>
      <option value="Art Direction">Art Direction</option>
      <option value="Photography">Photography</option>
      <option value="Mixed Media">Mixed Media</option>
    </select>
    <button type="button" class="remove-contributor-btn" aria-label="Remove contributor">&times;</button>
  `;
  row.querySelector('.remove-contributor-btn').addEventListener('click', () => {
    if (document.querySelectorAll('#contributorsList .contributor-row').length > 1) row.remove();
  });
  return row;
}

function initContributors() {
  const list = document.getElementById('contributorsList');
  if (list && list.children.length === 0) list.appendChild(createContributorRow());
}

function getContributors() {
  const rows = document.querySelectorAll('#contributorsList .contributor-row');
  return Array.from(rows).map(row => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    role: row.querySelector('[data-field="role"]').value
  })).filter(c => c.name);
}

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
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
    });
    container.appendChild(chip);
  });
}

function getGenrePickerValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return Array.from(container.querySelectorAll('.genre-chip.selected')).map(c => c.textContent);
}

// ========== DEV TOOLBAR (test mode) ==========
function initDevToolbar() {
  if (isSupabaseConfigured()) return; // Only show when Supabase is not set up

  const toolbar = document.createElement('div');
  toolbar.className = 'dev-toolbar';
  toolbar.innerHTML = `
    <span class="dev-toolbar-label">TEST MODE</span>
    <button class="dev-toolbar-btn ${getMockUserType() === 'guest' ? 'active' : ''}" data-mock="guest">Guest</button>
    <button class="dev-toolbar-btn ${getMockUserType() === 'standard' ? 'active' : ''}" data-mock="standard">User</button>
    <button class="dev-toolbar-btn ${getMockUserType() === 'curator' ? 'active' : ''}" data-mock="curator">Curator</button>
  `;

  toolbar.querySelectorAll('.dev-toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('.dev-toolbar-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setMockUser(btn.dataset.mock);
    });
  });

  document.body.appendChild(toolbar);
}

// ========== INIT ==========
async function init() {
  // Load covers (Supabase → static fallback)
  covers = await loadCovers();

  // Build filter options from loaded data
  allGenres = ['All', ...new Set(covers.flatMap(c => c.genre))];
  allDecades = ['All', ...new Set(covers.map(c => Math.floor(c.year / 10) * 10 + 's')).values()].sort();
  allRoles = ['All', ...new Set(covers.map(c => c.role))];

  // Set initial cover
  currentCover = covers[0];

  // Generate placeholders and start loading real artwork
  initPlaceholders(covers);

  // Initialize featured image
  const img = document.getElementById('featuredImg');
  img.src = coverImages[currentCover.id];
  img.alt = `${currentCover.title} by ${currentCover.musician}, cover art by ${currentCover.coverArtist}`;
  img.setAttribute('data-cover-id', currentCover.id);

  // Render everything
  renderAllFilterLists();
  renderActiveChips();
  renderGrids();
  renderThumbs();
  updateMeta(currentCover);

  // Initialize interactions
  initSwipe();
  initKeyboardNav();
  initTheme();
  initSearch();
  initFilterOverlay();
  initSubmitModal();
  initSaveButton();
  initFlagModal();
  initBurgerMenu();
  initAuthUI();

  // Initialize auth
  await initAuth();

  // Initialize i18n
  initI18n();

  // Dev toolbar (only shows when Supabase not configured)
  initDevToolbar();

  // Check URL for ?cover=ID deep link
  const urlParams = new URLSearchParams(window.location.search);
  const coverParam = urlParams.get('cover');
  if (coverParam) {
    const targetCover = covers.find(c => c.id === parseInt(coverParam));
    if (targetCover) selectCover(targetCover);
  }

  // Start loading real artwork in background
  fetchRealArtwork(covers);
}

init();
