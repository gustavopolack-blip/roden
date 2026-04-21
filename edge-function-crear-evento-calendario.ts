import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GCAL_MCP_URL = 'https://gcal.mcp.claude.com/mcp';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { titulo, fechaInicio, fechaFin, descripcion } = await req.json();
    if (!titulo || !fechaInicio || !fechaFin) {
      return new Response(JSON.stringify({ ok: false, error: 'Faltan campos requeridos' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Creá un evento en Google Calendar con estos datos exactos:
- Título: "${titulo}"
- Inicio: ${fechaInicio} (zona horaria America/Argentina/Buenos_Aires)
- Fin: ${fechaFin} (zona horaria America/Argentina/Buenos_Aires)
- Descripción: "${descripcion || 'Creado desde rødën OS'}"

Usá gcal_create_event con calendarId "primary" y sendUpdates "none".
Respondé SOLO con JSON válido, sin texto extra: {"ok": true, "link": "<htmlLink>"} o {"ok": false, "error": "<mensaje>"}.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-04-04',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        mcp_servers: [{ type: 'url', url: GCAL_MCP_URL, name: 'gcal' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || res.statusText;
      return new Response(JSON.stringify({ ok: false, error: `Error API: ${errMsg}` }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const text = (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    // Intentar extraer JSON de la respuesta
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(result), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      } catch (_) {}
    }

    // Fallback: buscar htmlLink en tool results
    const toolResults = (data.content || []).filter((b: any) => b.type === 'mcp_tool_result');
    for (const tr of toolResults) {
      const resultText = tr?.content?.[0]?.text || '';
      if (resultText.includes('htmlLink')) {
        const linkMatch = resultText.match(/https:\/\/www\.google\.com\/calendar\/event[^\s"]+/);
        return new Response(JSON.stringify({ ok: true, link: linkMatch?.[0] || '' }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      if (resultText.includes('"id"') && resultText.includes('"summary"')) {
        return new Response(JSON.stringify({ ok: true, link: '' }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ ok: false, error: 'No se pudo crear el evento' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
