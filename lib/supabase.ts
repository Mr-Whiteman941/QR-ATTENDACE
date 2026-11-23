import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ekfgessnoripfjlzanll.supabase.co";
const supabaseAnonKey = "sb_publishable_Ry0jPwN2b8avVWq0gySxnA_ZwR7BCSJ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
