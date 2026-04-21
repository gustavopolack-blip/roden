
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE SUPABASE ---
// Las credenciales deben estar en las variables de entorno.
// En desarrollo: archivo .env en la raíz del proyecto.
// En producción (Vercel): Environment Variables en el dashboard.
// Claves requeridas: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  || 'https://ugwrptmwmdxocdscsmxr.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnd3JwdG13bWR4b2Nkc2NzbXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDE0NTAsImV4cCI6MjA4ODkxNzQ1MH0.sj4gDMjscjVgHbUQylNeyHyDSSGCaqe6CG0KMl8-KRk';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "🚨 Error Crítico: Variables de entorno de Supabase no configuradas.\n" +
    "   Asegurate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});
