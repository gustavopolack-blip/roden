/**
 * api/gemini: solo usuarios con sesión de rødën OS y activos; el modelo lo fija el servidor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const generateContent = vi.fn(async () => ({ text: 'ok' }));
vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent }; } }));

import handler from '../api/gemini';

const call = async (headers: Record<string, string>, body: any) => {
  const out: { status?: number; json?: any } = {};
  const res: any = { status: (s: number) => { out.status = s; return res; }, json: (j: any) => { out.json = j; return res; } };
  await handler({ method: 'POST', headers, body }, res);
  return out;
};

/** Supabase simulado: token "bueno" = usuario ACTIVE, "inactivo" = usuario INACTIVE, otro = inválido. */
const supabaseFetch = vi.fn(async (url: string, init: any) => {
  const auth = init?.headers?.Authorization || '';
  const token = auth.replace('Bearer ', '');
  if (url.endsWith('/auth/v1/user')) {
    return token === 'bueno' || token === 'inactivo'
      ? new Response(JSON.stringify({ id: token === 'bueno' ? 'u1' : 'u2' }), { status: 200 })
      : new Response('{}', { status: 401 });
  }
  if (url.includes('/rest/v1/users')) {
    return new Response(JSON.stringify([{ status: url.includes('u1') ? 'ACTIVE' : 'INACTIVE' }]), { status: 200 });
  }
  throw new Error(`fetch inesperado: ${url}`);
});

describe('api/gemini', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'x';
    process.env.VITE_SUPABASE_URL = 'https://proyecto.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon';
    vi.stubGlobal('fetch', supabaseFetch);
    generateContent.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sin token, con token inválido o con usuario inactivo: 401 y no llama a Gemini', async () => {
    for (const headers of [{}, { authorization: 'Bearer cualquiera' }, { authorization: 'Bearer inactivo' }]) {
      const r = await call(headers, { userMessage: 'hola' });
      expect(r.status).toBe(401);
    }
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('usuario activo: responde, con el modelo fijo aunque pidan otro', async () => {
    const r = await call({ authorization: 'Bearer bueno' }, { userMessage: 'hola', model: 'gemini-2.5-pro', temperature: 7, responseMimeType: 'text/x-raro' });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ text: 'ok' });
    const args = (generateContent.mock.calls[0] as any[])[0];
    expect(args.model).toBe('gemini-2.5-flash');
    expect(args.config.temperature).toBe(1);
    expect(args.config.responseMimeType).toBeUndefined();
  });
});
