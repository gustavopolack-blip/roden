import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Vercel serverless function — proxies Gemini API calls server-side.
// The API key lives in process.env.GEMINI_API_KEY (set in Vercel dashboard,
// NOT prefixed with VITE_ so it is never bundled into the frontend).
//
// Access: requires `Authorization: Bearer <Supabase access_token>` of an ACTIVE
// user with role 'administrador' (the AI is admin-only, see PAGE_PERMISSIONS.ai).
// Supabase URL + anon key are public; in Vercel the VITE_ ones already exist and
// are also visible to functions, so SUPABASE_* is optional.

// Server-side whitelist: the client cannot pick an arbitrary (expensive) model.
const ALLOWED_MODELS = ['gemini-2.5-flash'];
const DEFAULT_MODEL = 'gemini-2.5-flash';

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

  const authHeader: string = req.headers?.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[api/gemini] Supabase URL / anon key not configured in environment.');
    return res.status(500).json({ error: 'Auth not configured' });
  }

  // Client scoped to the caller's JWT so the users query runs under their RLS.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (!profile || profile.role !== 'administrador' || profile.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const {
    systemInstruction,
    userMessage,
    temperature = 0.1,
    model = DEFAULT_MODEL,
    responseMimeType,
  } = req.body ?? {};

  if (!ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({ error: 'Model not allowed' });
  }

  if (!userMessage) {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });

    const response = await genAI.models.generateContent({
      model,
      contents: userMessage,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        temperature,
        ...(responseMimeType ? { responseMimeType } : {}),
      },
    });

    return res.status(200).json({ text: response.text ?? '' });
  } catch (error: any) {
    console.error('[api/gemini] Error:', error?.message ?? error);
    return res.status(500).json({ error: error?.message ?? 'Internal server error' });
  }
}
