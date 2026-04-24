import { GoogleGenAI } from '@google/genai';

// Vercel serverless function — proxies Gemini API calls server-side.
// The API key lives in process.env.GEMINI_API_KEY (set in Vercel dashboard,
// NOT prefixed with VITE_ so it is never bundled into the frontend).

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

  const {
    systemInstruction,
    userMessage,
    temperature = 0.1,
    model = 'gemini-2.0-flash',
    responseMimeType,
  } = req.body ?? {};

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
