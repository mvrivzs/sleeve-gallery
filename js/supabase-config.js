// Supabase client configuration
// Replace these with your actual Supabase project values
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://baxqmkpwiidwvurafyqy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_A-k-lozthlGbFkOIh9o2Ag__0LvqSx1';

// Check if Supabase is configured (not placeholder values)
export function isSupabaseConfigured() {
  return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_ANON_KEY';
}

// Lazy client — only created when Supabase is actually configured
let _client = null;
export const supabase = new Proxy({}, {
  get(_, prop) {
    if (!_client) {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase not configured');
      }
      _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _client[prop];
  }
});
