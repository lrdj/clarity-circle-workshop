// Vercel Serverless Function: POST /api/llm
// Env vars to set in Vercel project:
// - OPENAI_API_KEY (required)
// - CORS_ALLOW_ORIGIN (optional; e.g., https://your-gh-pages-domain)

export default async function handler(req, res) {
  const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { op, text } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'Missing text' });
  if (!['rephrase', 'causes'].includes(op)) return res.status(400).json({ error: 'Invalid op' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });

  const system = op === 'rephrase'
    ? 'Rewrite into 1–5 short, single-idea problem statements. No solutions. Output bullets only.'
    : 'Suggest 3–7 plausible causes. Bulleted, concise, no solutions or advice. Output bullets only.';

  const user = `User text:\n${truncate(text, 1200)}\nReturn bullets only.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.3,
        max_tokens: 400
      }),
      // @ts-ignore
      signal: AbortSignal.timeout(15000)
    });
    if (!r.ok) {
      const errText = await safeText(r);
      return res.status(502).json({ error: 'Upstream error', detail: errText.slice(0, 200) });
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '';
    const suggestions = toBullets(content).slice(0, 10);
    return res.json({ suggestions });
  } catch (e) {
    return res.status(500).json({ error: 'Proxy failure' });
  }
}

function truncate(s, n) { return (s || '').slice(0, n); }
function toBullets(s) {
  return (s || '')
    .split(/\n+/)
    .map(x => x.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean);
}
async function safeText(resp) { try { return await resp.text(); } catch { return ''; } }

