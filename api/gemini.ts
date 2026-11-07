import { GoogleGenAI } from '@google/genai';

// Vercel serverless function — proxies Gemini API calls server-side.
// The API key lives in process.env.GEMINI_API_KEY (set in Vercel dashboard,
// NOT prefixed with VITE_ so it is never bundled into the frontend).
// Only signed-in, ACTIVE users of rødën OS may call it (Supabase session token in
// Authorization: Bearer). The model is fixed here: callers cannot pick a pricier one.

const MODEL = 'gemini-2.5-flash';

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[api/gemini] GEMINI_API_KEY not configured in environment.');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const token = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  const user = await activeUserFor(token).catch(() => null);
  if (!user) {
    return res.status(401).json({ error: 'Sesión inválida o usuario inactivo' });
  }

  const {
    systemInstruction,
    userMessage,
    temperature = 0.1,
    responseMimeType,
  } = req.body ?? {};

  if (!userMessage) {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });

    const response = await genAI.models.generateContent({
      model: MODEL,
      contents: userMessage,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        temperature: Math.min(1, Math.max(0, Number(temperature) || 0)),
        ...(responseMimeType === 'application/json' ? { responseMimeType } : {}),
      },
    });

    return res.status(200).json({ text: response.text ?? '' });
  } catch (error: any) {
    console.error('[api/gemini] Error:', error?.message ?? error);
    return res.status(500).json({ error: error?.message ?? 'Internal server error' });
  }
}
