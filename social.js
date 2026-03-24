// Social features — save covers, friendships
import { supabase, isSupabaseConfigured } from './supabase-config.js';
import { getUser } from './auth.js';

// ========== SAVED COVERS ==========

let savedCoverIds = new Set();

export function isSaved(coverId) {
  return savedCoverIds.has(coverId);
}

export async function loadSavedCovers() {
  const user = getUser();
  if (!user || !isSupabaseConfigured()) return;

  const { data, error } = await supabase
    .from('saved_covers')
    .select('cover_id')
    .eq('user_id', user.id);

  if (!error && data) {
    savedCoverIds = new Set(data.map(r => r.cover_id));
  }
}

export async function toggleSave(coverId) {
  const user = getUser();
  if (!user) throw new Error('Not logged in');

  if (savedCoverIds.has(coverId)) {
    // Unsave
    const { error } = await supabase
      .from('saved_covers')
      .delete()
      .eq('user_id', user.id)
      .eq('cover_id', coverId);
    if (error) throw error;
    savedCoverIds.delete(coverId);
  } else {
    // Save
    const { error } = await supabase
      .from('saved_covers')
      .insert({ user_id: user.id, cover_id: coverId });
    if (error) throw error;
    savedCoverIds.add(coverId);
  }
  return savedCoverIds.has(coverId);
}

export async function getSavedCovers() {
  const user = getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('saved_covers')
    .select('cover_id, covers(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(r => r.covers);
}

// ========== FRIENDSHIPS ==========

export async function sendFriendRequest(addresseeId) {
  const user = getUser();
  if (!user) throw new Error('Not logged in');

  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: user.id, addressee_id: addresseeId });
  if (error) throw error;
}

export async function respondToFriendRequest(friendshipId, accept) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function getFriends() {
  const user = getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted');

  if (error) throw error;
  return data.map(f => ({
    friendshipId: f.id,
    friend: f.requester_id === user.id ? f.addressee : f.requester
  }));
}

export async function getPendingRequests() {
  const user = getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select('*, requester:profiles!friendships_requester_id_fkey(*)')
    .eq('addressee_id', user.id)
    .eq('status', 'pending');

  if (error) throw error;
  return data;
}
