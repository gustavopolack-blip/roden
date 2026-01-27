
import { createClient } from '@supabase/supabase-js';

// Safe environment variable access for various build tools (Vite, CRA, etc.)
const getEnvVar = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // @ts-ignore - import.meta might not be typed in all setups
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return '';
};

const supabaseUrl = getEnvVar('REACT_APP_SUPABASE_URL') || getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('REACT_APP_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');

// Fallback to avoid "supabaseUrl is required" error during initialization
// This allows the app to load even if credentials are not yet set
const effectiveUrl = supabaseUrl || 'https://placeholder.supabase.co';
const effectiveKey = supabaseAnonKey || 'placeholder';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. App running in offline/demo mode (requests will fail).');
}

export const supabase = createClient(effectiveUrl, effectiveKey);
