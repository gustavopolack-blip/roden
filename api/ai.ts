// Vercel serverless function — proxies the AI calls of rødën OS to OpenAI (ChatGPT models),
// server-side. Configuración en Vercel → Environment Variables (sin prefijo VITE_, así nunca
// llegan al navegador):
//   OPENAI_API_KEY  clave de API de platform.openai.com (no es la suscripción de ChatGPT)
//   OPENAI_MODEL    id del modelo, tal como figura en la documentación de OpenAI
// Only signed-in, ACTIVE users of rødën OS may call it (Supabase session token in
// Authorization: Bearer). The model comes from the server config: callers cannot pick it.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/** The caller's Supabase user if the token is valid and the user is ACTIVE; null otherwise. */
const activeUserFor = async (token: string): Promise<{ id: string } | null> => {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !token) return null;
  const headers = { apikey: anonKey, Authorization: `Bearer ${token}` };
  const u = await fetch(`${url}/auth/v1/user`, { headers });
  if (!u.ok) return null;
  const { id } = await u.json();
  const p = await fetch(`${url}/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=status`, { headers });
  if (!p.ok) return null;
  const rows = await p.json();
  return rows?.[0]?.status === 'ACTIVE' ? { id } : null;
};

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    console.error('[api/ai] OPENAI_API_KEY u OPENAI_MODEL sin configurar.');
    return res.status(500).json({ error: 'IA sin configurar: faltan OPENAI_API_KEY u OPENAI_MODEL en Vercel' });
  }

  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  const user = await activeUserFor(token).catch(() => null);
  if (!user) {
    return res.status(401).json({ error: 'Sesión inválida o usuario inactivo' });
  }

  const { systemInstruction, userMessage } = req.body ?? {};
  if (!userMessage) {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  try {
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
          { role: 'user', content: userMessage },
        ],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const message = data?.error?.message || `OpenAI respondió ${r.status}`;
      console.error('[api/ai] OpenAI error:', r.status, message);
      return res.status(502).json({ error: message });
    }
    return res.status(200).json({ text: data?.choices?.[0]?.message?.content ?? '' });
  } catch (error: any) {
    console.error('[api/ai] Error:', error?.message ?? error);
    return res.status(500).json({ error: error?.message ?? 'Internal server error' });
  }
}
