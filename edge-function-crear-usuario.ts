// Edge Function de Supabase "crear-usuario" (desplegada en el proyecto rødën Sistema Operativo).
// Alta de personal desde Personal (pages/Staff.tsx): solo un administrador activo puede crear usuarios.
// Crea el usuario con la clave de servicio (no cierra la sesión del administrador) y pone el rol en
// app_metadata, que solo se puede escribir del lado servidor. El trigger handle_new_user lee el rol
// de ahí: el rol que mande un navegador en un registro (user_metadata) se ignora.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ROLES = ['administrador', 'gerente_taller', 'operario_taller'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  // Quién llama: sesión válida de un administrador activo.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller?.user) return reply(401, { error: 'Sesión inválida' });
  const { data: profile } = await admin.from('users').select('role, status').eq('id', caller.user.id).maybeSingle();
  if (profile?.role !== 'administrador' || profile?.status !== 'ACTIVE') {
    return reply(403, { error: 'Solo un administrador puede crear usuarios' });
  }

  const { email, password, name, phone, role } = await req.json().catch(() => ({}));
  if (!email || !password || !name) return reply(400, { error: 'Faltan email, contraseña o nombre' });
  if (String(password).length < 8) return reply(400, { error: 'La contraseña debe tener al menos 8 caracteres' });
  if (!ROLES.includes(role)) return reply(400, { error: `Rol inválido: ${role}` });

  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name, phone: phone || null },
    app_metadata: { role },
  });
  if (error) return reply(400, { error: error.message });
  return reply(200, { id: data.user.id });
});
