
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURACIÓN DE SUPABASE ---
// INSTRUCCIONES:
// 1. Ve a Supabase > Settings > API
// 2. Copia "Project URL" y pégalo abajo.
// 3. Copia "Project API Key (anon public)" y pégalo abajo.

// Si usas Vite o Create React App, intentaremos leer las variables de entorno primero.
// Si no funcionan, usa las cadenas de texto directas.

// Helper para obtener variables de entorno de manera segura en diferentes entornos
const getEnvVar = (viteKey: string, reactKey: string) => {
  let val = '';
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    // @ts-ignore
    val = import.meta.env[viteKey];
  }
  if (!val && typeof process !== 'undefined' && process.env && process.env[reactKey]) {
    val = process.env[reactKey] || '';
  }
  return val;
};

const SUPABASE_URL = 
  getEnvVar('VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL') || 
  "https://fjvrfddgmzuunbxzcwmr.supabase.co";

const SUPABASE_ANON_KEY = 
  getEnvVar('VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY') || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdnJmZGRnbXp1dW5ieHpjd21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MjE5NDEsImV4cCI6MjA4NTE5Nzk0MX0.sbnhT94fuoNcCPD7RFDKd27xM8HFl07FfhF0DpytNRw";

// Validación simple
if (SUPABASE_URL.includes("PEGAR_TU") || SUPABASE_ANON_KEY.includes("PEGAR_TU")) {
  console.warn("⚠️ ATENCIÓN: No has configurado las claves de Supabase en services/supabaseClient.ts");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});
