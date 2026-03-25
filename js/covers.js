// Cover data loading — Supabase with static fallback
import { supabase, isSupabaseConfigured } from './supabase-config.js';
import { STATIC_COVERS } from './data-static.js';

// Transform database snake_case to JS camelCase
function transformDbToLocal(row) {
  return {
    id: row.id,
    title: row.title,
    musician: row.musician,
    coverArtist: row.cover_artist,
    role: row.artist_role,
    year: row.year,
    label: row.label,
    genre: row.genre || [],
    curatorNote: row.curator_note || '',
    spotifyId: row.spotify_id || '',
    hue: row.hue || 0,
    sat: row.sat || 0,
    lit: row.lit || 25,
    contributors: row.contributors || [],
    status: row.status,
    submittedBy: row.submitted_by,
    amazonUrl: row.amazon_url || row.amazonUrl || ''
  };
}

// Transform JS camelCase to database snake_case
export function transformLocalToDb(cover) {
  return {
    title: cover.title,
    musician: cover.musician,
    cover_artist: cover.coverArtist || cover.cover_artist || '',
    artist_role: cover.role || cover.artist_role || '',
    year: cover.year ? parseInt(cover.year) : null,
    label: cover.label || '',
    genre: cover.genre || [],
    curator_note: cover.curatorNote || cover.curator_note || '',
    spotify_id: cover.spotifyId || cover.spotify_id || '',
    hue: cover.hue || 0,
    sat: cover.sat || 0,
    lit: cover.lit || 25,
    contributors: cover.contributors || [],
    status: cover.status || 'pending',
    submitted_by: cover.submittedBy || cover.submitted_by || null,
    amazon_url: cover.amazonUrl || cover.amazon_url || ''
  };
}

// ========== MOCK LOCAL STORAGE ==========
const MOCK_STORAGE_KEY = 'sleeve-mock-covers';

function getMockCovers() {
  try {
    return JSON.parse(localStorage.getItem(MOCK_STORAGE_KEY) || '[]');
  } catch(e) { return []; }
}

function saveMockCovers(covers) {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(covers));
}

function getNextMockId() {
  const all = [...STATIC_COVERS, ...getMockCovers()];
  return Math.max(...all.map(c => c.id || 0), 0) + 1;
}

// ========== COVER OPERATIONS ==========

// Load approved covers — try Supabase first, fall back to static + mock
export async function loadCovers() {
  if (!isSupabaseConfigured()) {
    const mockApproved = getMockCovers().filter(c => c.status === 'approved');
    return [...STATIC_COVERS, ...mockApproved];
  }

  try {
    const { data, error } = await supabase
      .from('covers')
      .select('*')
      .eq('status', 'approved')
      .order('id');

    if (error) throw error;
    return data.map(transformDbToLocal);
  } catch (e) {
    console.warn('Supabase fetch failed, using static data:', e.message);
    return STATIC_COVERS;
  }
}

// Submit a new cover (pending approval)
export async function submitCover(coverData) {
  if (!isSupabaseConfigured()) {
    // Mock mode — store in localStorage
    const mockCovers = getMockCovers();
    const newCover = {
      ...coverData,
      id: getNextMockId(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    mockCovers.push(newCover);
    saveMockCovers(mockCovers);
    return newCover;
  }

  const dbData = transformLocalToDb(coverData);
  dbData.status = 'pending';

  const { data, error } = await supabase
    .from('covers')
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Load pending covers (for curators)
export async function loadPendingCovers() {
  if (!isSupabaseConfigured()) {
    return getMockCovers().filter(c => c.status === 'pending');
  }

  const { data, error } = await supabase
    .from('covers')
    .select('*, profiles!covers_submitted_by_fkey(display_name, avatar_url)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(transformDbToLocal);
}

// Approve or reject a cover (curator only)
export async function reviewCover(coverId, status, reviewerId) {
  if (!isSupabaseConfigured()) {
    // Mock mode — update in localStorage
    const mockCovers = getMockCovers();
    const cover = mockCovers.find(c => c.id === coverId);
    if (cover) {
      cover.status = status;
      cover.reviewedBy = reviewerId;
      cover.reviewedAt = new Date().toISOString();
      saveMockCovers(mockCovers);
    }
    return;
  }

  const { error } = await supabase
    .from('covers')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', coverId);

  if (error) throw error;
}

// Load ALL covers (for curator management)
export async function loadAllCovers() {
  if (!isSupabaseConfigured()) {
    const mockCovers = getMockCovers();
    return [...STATIC_COVERS.map(c => ({ ...c, status: 'approved', source: 'static' })), ...mockCovers];
  }

  const { data, error } = await supabase
    .from('covers')
    .select('*')
    .order('id');

  if (error) throw error;
  return data.map(transformDbToLocal);
}

// Update a cover's metadata (curator only)
export async function updateCover(coverId, updates) {
  if (!isSupabaseConfigured()) {
    // Check if it's a static cover — can't edit those in mock mode
    const staticCover = STATIC_COVERS.find(c => c.id === coverId);
    if (staticCover) {
      // Update the static cover in-memory (won't persist across reloads for static data)
      Object.assign(staticCover, updates);
      return;
    }
    const mockCovers = getMockCovers();
    const cover = mockCovers.find(c => c.id === coverId);
    if (cover) {
      Object.assign(cover, updates);
      saveMockCovers(mockCovers);
    }
    return;
  }

  const dbUpdates = transformLocalToDb(updates);
  const { error } = await supabase
    .from('covers')
    .update(dbUpdates)
    .eq('id', coverId);

  if (error) throw error;
}

// Delete a cover (curator only)
export async function deleteCover(coverId) {
  if (!isSupabaseConfigured()) {
    // Can't delete static covers in mock mode
    const mockCovers = getMockCovers();
    const filtered = mockCovers.filter(c => c.id !== coverId);
    saveMockCovers(filtered);
    return;
  }

  const { error } = await supabase
    .from('covers')
    .delete()
    .eq('id', coverId);

  if (error) throw error;
}

// ========== FLAGS ==========
const FLAG_STORAGE_KEY = 'sleeve-mock-flags';

function getMockFlags() {
  try {
    return JSON.parse(localStorage.getItem(FLAG_STORAGE_KEY) || '[]');
  } catch(e) { return []; }
}

function saveMockFlags(flags) {
  localStorage.setItem(FLAG_STORAGE_KEY, JSON.stringify(flags));
}

export async function submitFlag({ coverId, coverTitle, coverMusician, type, description, submittedBy }) {
  if (!isSupabaseConfigured()) {
    const flags = getMockFlags();
    const maxId = flags.length ? Math.max(...flags.map(f => f.id)) : 0;
    const flag = {
      id: maxId + 1,
      coverId,
      coverTitle,
      coverMusician,
      type,
      description,
      submittedBy,
      status: 'open',
      createdAt: new Date().toISOString()
    };
    flags.push(flag);
    saveMockFlags(flags);
    return flag;
  }

  const { data, error } = await supabase
    .from('flags')
    .insert({ cover_id: coverId, cover_title: coverTitle, cover_musician: coverMusician, type, description, submitted_by: submittedBy, status: 'open' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadFlags() {
  if (!isSupabaseConfigured()) {
    return getMockFlags().filter(f => f.status === 'open');
  }

  const { data, error } = await supabase
    .from('flags')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function resolveFlag(flagId) {
  if (!isSupabaseConfigured()) {
    const flags = getMockFlags();
    const flag = flags.find(f => f.id === flagId);
    if (flag) {
      flag.status = 'resolved';
      saveMockFlags(flags);
    }
    return;
  }

  const { error } = await supabase
    .from('flags')
    .update({ status: 'resolved' })
    .eq('id', flagId);
  if (error) throw error;
}
