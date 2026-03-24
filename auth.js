// Authentication module — Google + Spotify OAuth via Supabase
import { supabase, isSupabaseConfigured } from './supabase-config.js';

let currentUser = null;
let currentProfile = null;
const authListeners = [];

// Subscribe to auth state changes
export function onAuthChange(callback) {
  authListeners.push(callback);
  // Immediately call with current state
  if (currentUser !== undefined) {
    callback(currentUser, currentProfile);
  }
}

function notifyListeners() {
  authListeners.forEach(cb => cb(currentUser, currentProfile));
}

// Get current user
export function getUser() { return currentUser; }
export function getProfile() { return currentProfile; }

// Fetch user profile from profiles table
async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.warn('Failed to fetch profile:', error.message);
    return null;
  }
  return data;
}

// Sign in with Google
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) throw error;
}

// Sign in with Spotify
export async function signInWithSpotify() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'spotify',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
      scopes: 'user-read-email'
    }
  });
  if (error) throw error;
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  currentUser = null;
  currentProfile = null;
  notifyListeners();
}

// Update user profile
export async function updateProfile(updates) {
  if (!currentUser) throw new Error('Not logged in');

  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', currentUser.id)
    .select()
    .single();

  if (error) throw error;
  currentProfile = data;
  notifyListeners();
  return data;
}

// Check if current user is a curator
export function isCurator() {
  return currentProfile?.role === 'curator';
}

// Initialize auth — call once on page load
export async function initAuth() {
  if (!isSupabaseConfigured()) {
    currentUser = null;
    currentProfile = null;
    notifyListeners();
    return;
  }

  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      currentProfile = await fetchProfile(session.user.id);
      notifyListeners();
    } else {
      currentUser = null;
      currentProfile = null;
      notifyListeners();
    }
  });

  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    currentProfile = await fetchProfile(session.user.id);
    notifyListeners();
  } else {
    notifyListeners();
  }
}
