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
    submittedBy: row.submitted_by
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
    submitted_by: cover.submittedBy || cover.submitted_by || null
  };
}

// Load approved covers — try Supabase first, fall back to static
export async function loadCovers() {
  if (!isSupabaseConfigured()) {
    console.info('Supabase not configured — using static cover data');
    return STATIC_COVERS;
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
    throw new Error('Supabase not configured');
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
