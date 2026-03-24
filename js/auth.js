// Authentication module — Google + Spotify OAuth via Supabase
import { supabase, isSupabaseConfigured } from './supabase-config.js';

let currentUser = null;
let currentProfile = null;
const authListeners = [];

// ========== MOCK USERS (dev/test mode) ==========
const MOCK_USERS = {
  guest: { user: null, profile: null },
  standard: {
    user: { id: 'mock-user-001', email: 'maria@example.com' },
    profile: {
      id: 'mock-user-001',
      display_name: 'Maria R.',
      avatar_url: '',
      bio: 'Vinyl collector & music lover',
      role: 'user',
      created_at: '2025-01-15T00:00:00Z',
      updated_at: '2025-01-15T00:00:00Z'
    }
  },
  curator: {
    user: { id: 'mock-curator-001', email: 'curator@sleeve.gallery' },
    profile: {
      id: 'mock-curator-001',
      display_name: 'Alex Curator',
      avatar_url: '',
      bio: 'Cover art curator & gallery manager',
      role: 'curator',
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z'
    }
  }
};

// Switch to a mock user (for testing without Supabase)
export function setMockUser(type) {
  const mock = MOCK_USERS[type];
  if (!mock) return;
  currentUser = mock.user;
  currentProfile = mock.profile;
  localStorage.setItem('sleeve-mock-user', type);
  notifyListeners();
}

export function getMockUserType() {
  return localStorage.getItem('sleeve-mock-user') || 'guest';
}

function isMockMode() {
  return !isSupabaseConfigured();
}

// Mock email/password accounts
const MOCK_ACCOUNTS = {
  'curator@sleeve.gallery': { password: 'curator123', mockType: 'curator' },
  'maria@example.com': { password: 'user123', mockType: 'standard' }
};

// Sign in with email/password (mock mode or Supabase)
export async function signInWithEmail(email, password) {
  if (isMockMode()) {
    const account = MOCK_ACCOUNTS[email.toLowerCase()];
    if (!account) throw new Error('Account not found');
    if (account.password !== password) throw new Error('Wrong password');
    setMockUser(account.mockType);
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// Sign up with email/password + name
export async function signUpWithEmail(email, password, firstName, lastName) {
  const displayName = `${firstName} ${lastName}`.trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: displayName }
    }
  });
  if (error) throw error;
  return data;
}

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
    .limit(1);

  if (error) {
    console.warn('Failed to fetch profile:', error.message);
    return null;
  }
  return data?.[0] || null;
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
  if (isMockMode()) {
    setMockUser('guest');
    return;
  }
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
    // Mock mode — restore saved mock user
    const savedMock = localStorage.getItem('sleeve-mock-user') || 'guest';
    const mock = MOCK_USERS[savedMock];
    currentUser = mock?.user || null;
    currentProfile = mock?.profile || null;
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
