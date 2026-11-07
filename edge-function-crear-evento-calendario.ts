// Edge Function de Supabase "crear-evento-calendario" (proyecto rødën Sistema Operativo).
// Crea un evento en el Google Calendar de quien llama, con el token de Google que manda.
// Hoy la app no la usa (Notas abre Google Calendar con un enlace); se conserva por si se retoma.
// Solo atiende a usuarios con sesión de rødën OS (7/11/2026): antes estaba abierta a cualquiera.
// Este archivo es la versión desplegada; el anterior del repo (vía Anthropic) estaba desactualizado.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Sesión de un usuario (no alcanza con la clave publicable, que va en la app).
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth?.user) {
    return new Response(JSON.stringify({ ok: false, error: 'Sesión inválida' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { titulo, fechaInicio, fechaFin, descripcion, googleToken } = await req.json();

    if (!titulo || !fechaInicio || !fechaFin) {
      return new Response(JSON.stringify({ ok: false, error: 'Faltan campos requeridos' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!googleToken) {
      return new Response(JSON.stringify({ ok: false, error: 'Token de Google no disponible. Cerrá sesión y volvé a entrar con Google.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Construir evento para Google Calendar API
    const event = {
      summary: titulo,
      description: descripcion || 'Creado desde rødën OS',
      start: {
        dateTime: `${fechaInicio}-03:00`,
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      end: {
        dateTime: `${fechaFin}-03:00`,
        timeZone: 'America/Argentina/Buenos_Aires',
      },
    };

    // Llamar a Google Calendar API directamente con el token del usuario
    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    const calData = await calRes.json();

    if (!calRes.ok) {
      const errMsg = calData?.error?.message || calRes.statusText;
      // Token expirado
      if (calRes.status === 401) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'Sesión de Google expirada. Cerrá sesión y volvé a entrar con Google.'
        }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      link: calData.htmlLink || '',
      eventId: calData.id,
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
