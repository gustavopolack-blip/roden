import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks de Supabase y Gemini: el test verifica el control de acceso del proxy,
// no las APIs externas.
const getUser = vi.fn();
const maybeSingle = vi.fn();
const generateContent = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import handler from '../api/gemini';

const makeRes = () => {
  const res: any = {};
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: any) => { res.body = body; return res; });
  return res;
};

const post = (headers: Record<string, string>, body: any = { userMessage: 'hola' }) =>
  ({ method: 'POST', headers, body });

describe('api/gemini — control de acceso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon';
    generateContent.mockResolvedValue({ text: 'ok' });
  });

  it('POST sin token → 401 y no llama a Gemini', async () => {
    const res = makeRes();
    await handler(post({}), res);
    expect(res.statusCode).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('token inválido → 401', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });
    const res = makeRes();
    await handler(post({ authorization: 'Bearer basura' }), res);
    expect(res.statusCode).toBe(401);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('usuario válido que no es administrador → 403', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'gerente_taller', status: 'ACTIVE' } });
    const res = makeRes();
    await handler(post({ authorization: 'Bearer t' }), res);
    expect(res.statusCode).toBe(403);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('admin con modelo fuera de la lista blanca → 400', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'administrador', status: 'ACTIVE' } });
    const res = makeRes();
    await handler(post({ authorization: 'Bearer t' }, { userMessage: 'hola', model: 'gemini-2.5-pro' }), res);
    expect(res.statusCode).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('admin activo → 200 con el modelo por defecto', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'administrador', status: 'ACTIVE' } });
    const res = makeRes();
    await handler(post({ authorization: 'Bearer t' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ text: 'ok' });
    expect(generateContent.mock.calls[0][0].model).toBe('gemini-2.5-flash');
  });
});
