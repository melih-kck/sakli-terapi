import { createClient } from '@supabase/supabase-js';
import { IS_DEMO_MODE } from '../config/runtime';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const demoSupabaseUrl = 'http://127.0.0.1:54321';
const demoSupabaseAnonKey = 'sakli-terapi-demo-anon-key';
const resolvedSupabaseUrl = IS_DEMO_MODE ? supabaseUrl || demoSupabaseUrl : supabaseUrl;
const resolvedSupabaseAnonKey = IS_DEMO_MODE ? supabaseAnonKey || demoSupabaseAnonKey : supabaseAnonKey;

if ((!supabaseUrl || !supabaseAnonKey) && !IS_DEMO_MODE) {
  console.warn('Eksik Supabase ortam değişkenleri. Lütfen .env dosyasını kontrol edin.');
}

export const supabase = createClient(
  resolvedSupabaseUrl,
  resolvedSupabaseAnonKey,
  {
    auth: {
      persistSession: !IS_DEMO_MODE,
      autoRefreshToken: !IS_DEMO_MODE,
      detectSessionInUrl: !IS_DEMO_MODE,
    },
  },
);
