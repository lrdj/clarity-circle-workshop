// Netlify Function: /.netlify/functions/llm
// Env vars in Netlify site settings:
// - OPENAI_API_KEY (required)
// - CORS_ALLOW_ORIGIN (optional)

export async function handler(event) {
  const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(allowOrigin) };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(allowOrigin), body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const body = safeParse(event.body);
  const { op, text } = body || {};
  if (!text || typeof text !== 'string' || !['rephrase','causes'].includes(op)) {
    return { statusCode: 400, headers: corsHeaders(allowOrigin), body: JSON.stringify({ error: 'Invalid input' }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders(allowOrigin), body: JSON.stringify({ error: 'OPENAI_API_KEY not set' }) };
  }

  const system = op === 'rephrase'
    ? 'Rewrite into 1–5 short, single-idea problem statements. No solutions. Output bullets only.'
    : 'Suggest 3–7 plausible causes. Bulleted, concise, no solutions or advice. Output bullets only.';
  const user = `User text:\n${truncate(text, 1200)}\nReturn bullets only.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
        temperature: 0.3,
        max_tokens: 400
      }),
      // @ts-ignore
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) {
      const detail = await r.text();
      return { statusCode: 502, headers: corsHeaders(allowOrigin), body: JSON.stringify({ error: 'Upstream error', detail: (detail||'').slice(0,200) }) };
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '';
    const suggestions = toBullets(content).slice(0, 10);
    return { statusCode: 200, headers: corsHeaders(allowOrigin), body: JSON.stringify({ suggestions }) };
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders(allowOrigin), body: JSON.stringify({ error: 'Proxy failure' }) };
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}
function safeParse(s) { try { return JSON.parse(s || '{}'); } catch { return null; } }
function truncate(s, n) { return (s || '').slice(0, n); }
function toBullets(s) { return (s || '').split(/\n+/).map(x => x.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean); }

