// Vercel serverless function — chequeo de salud para un monitor externo (ej. UptimeRobot cada 5 min).
// URL de producción: https://www.rodenmobel.com/os/api/health
// 200 = la función responde y la base de Supabase contesta una consulta real; 503 = no.
// La consulta es a web_portfolio (lectura pública, sin datos sensibles). De paso, el pedido
// periódico cuenta como actividad y evita que el plan Free de Supabase pause el proyecto.

export default async function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return res.status(503).json({ ok: false, error: 'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY' });
  }

  const started = Date.now();
  try {
    const r = await fetch(`${url}/rest/v1/web_portfolio?select=id&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: AbortSignal.timeout(10000),
    });
    const dbMs = Date.now() - started;
    if (!r.ok) return res.status(503).json({ ok: false, error: `Supabase respondió ${r.status}`, dbMs });
    return res.status(200).json({ ok: true, dbMs });
  } catch (error: any) {
    return res.status(503).json({ ok: false, error: error?.name === 'TimeoutError' ? 'Supabase no respondió en 10 s' : String(error?.message ?? error) });
  }
}
