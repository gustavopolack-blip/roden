/**
 * api/ai: solo usuarios con sesión de rødën OS y activos; el modelo lo fija el servidor (OPENAI_MODEL).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/ai';

const call = async (headers: Record<string, string>, body: any) => {
  const out: { status?: number; json?: any } = {};
  const res: any = { status: (s: number) => { out.status = s; return res; }, json: (j: any) => { out.json = j; return res; } };
  await handler({ method: 'POST', headers, body }, res);
  return out;
};

const openaiCalls: any[] = [];
/** Supabase simulado (token "bueno" = ACTIVE, "inactivo" = INACTIVE) y OpenAI simulado. */
const fakeFetch = vi.fn(async (url: string, init: any) => {
  if (url.startsWith('https://api.openai.com/')) {
    openaiCalls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'respuesta' } }] }), { status: 200 });
  }
  const token = (init?.headers?.Authorization || '').replace('Bearer ', '');
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

describe('api/ai', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENAI_MODEL = 'modelo-configurado';
    process.env.VITE_SUPABASE_URL = 'https://proyecto.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon';
    vi.stubGlobal('fetch', fakeFetch);
    openaiCalls.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sin token, con token inválido o con usuario inactivo: 401 y no llama a OpenAI', async () => {
    for (const headers of [{}, { authorization: 'Bearer cualquiera' }, { authorization: 'Bearer inactivo' }]) {
      const r = await call(headers, { userMessage: 'hola' });
      expect(r.status).toBe(401);
    }
    expect(openaiCalls).toHaveLength(0);
  });

  it('usuario activo: responde con el modelo configurado aunque pidan otro', async () => {
    const r = await call({ authorization: 'Bearer bueno' }, { systemInstruction: 'sos rødën AI', userMessage: 'hola', model: 'otro-mas-caro' });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ text: 'respuesta' });
    expect(openaiCalls[0].model).toBe('modelo-configurado');
    expect(openaiCalls[0].messages).toEqual([{ role: 'system', content: 'sos rødën AI' }, { role: 'user', content: 'hola' }]);
  });

  it('sin clave o sin modelo configurados: 500 con un mensaje claro', async () => {
    delete process.env.OPENAI_MODEL;
    const r = await call({ authorization: 'Bearer bueno' }, { userMessage: 'hola' });
    expect(r.status).toBe(500);
    expect(r.json.error).toMatch(/OPENAI_MODEL/);
  });
});
