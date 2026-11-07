/**
 * api/health: 200 si Supabase contesta; 503 si falla, tarda o falta configuración.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../api/health';

const call = async () => {
  const out: { status?: number; json?: any } = {};
  const res: any = { setHeader: () => {}, status: (s: number) => { out.status = s; return res; }, json: (j: any) => { out.json = j; return res; } };
  await handler({}, res);
  return out;
};

describe('api/health', () => {
  beforeEach(() => { process.env.VITE_SUPABASE_URL = 'https://p.supabase.co'; process.env.VITE_SUPABASE_ANON_KEY = 'anon'; });
  afterEach(() => vi.unstubAllGlobals());

  it('base que contesta: 200 con la demora', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    const r = await call();
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    expect(typeof r.json.dbMs).toBe('number');
  });
  it('base con error o caída: 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    expect((await call()).status).toBe(503);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    expect((await call()).status).toBe(503);
  });
  it('sin configuración: 503', async () => {
    delete process.env.VITE_SUPABASE_URL;
    expect((await call()).status).toBe(503);
  });
});
