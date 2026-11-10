// Crest's AI service. /v1/sort: the phone sends only alerts it couldn't sort itself (account numbers already removed);
// this asks Claude what each one is and sends back a kind, a tidy name and a category. /v1/ask: Ask Crest, where Claude
// answers questions with tools the phone runs over its own data. Nothing is stored here.
import { buildRequest, checkBody, readResults } from './sort.js';
import { buildAsk, checkAsk, readAsk } from './ask.js';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-kitty-key, x-kitty-install', 'access-control-allow-methods': 'POST, OPTIONS' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ ok: true, model: env.MODEL });
    if (req.method !== 'POST' || (url.pathname !== '/v1/sort' && url.pathname !== '/v1/ask')) return json({ error: 'Not found' }, 404);
    if (env.APP_KEY && req.headers.get('x-kitty-key') !== env.APP_KEY) return json({ error: 'Not allowed' }, 401);
    if (!/^[a-z0-9]{12,40}$/.test(req.headers.get('x-kitty-install') || '')) return json({ error: 'Missing install id' }, 400);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'AI is not set up yet' }, 503);

    if (url.pathname === '/v1/ask') {
      let ask;
      try { ask = checkAsk(await req.json()); } catch (e) { return json({ error: String(e.message || e) }, 400); }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(buildAsk(ask, env.MODEL || 'claude-haiku-5-5')),
      });
      if (!res.ok) return json({ error: `AI service error ${res.status}` }, 502);
      try { return json(readAsk(await res.json())); } catch (e) { return json({ error: String(e.message || e) }, 502); }
    }

    let body;
    try { body = checkBody(await req.json()); } catch (e) { return json({ error: String(e.message || e) }, 400); }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(buildRequest(body, env.MODEL || 'claude-haiku-5-5')),
    });
    if (!res.ok) return json({ error: `AI service error ${res.status}` }, 502);
    try { return json({ results: readResults(await res.json(), body) }); } catch (e) { return json({ error: String(e.message || e) }, 502); }
  },
};
