// node ai/worker/src/ask.test.mjs
import assert from 'node:assert/strict';
import { buildAsk, checkAsk, readAsk, TOOLS } from './ask.js';

const body = checkAsk({ today: '2026-11-10', currency: 'GBP', messages: [{ role: 'user', content: 'Can I afford £80 on Friday?' }] });
assert.equal(body.today, '2026-11-10');
const req = buildAsk(body, 'claude-haiku-5-5');
assert.equal(req.tools.length, TOOLS.length);
assert.ok(req.tools[req.tools.length - 1].cache_control);
assert.match(req.system[0].text, /Today is 2026-11-10/);

// A tool round trip is accepted; unknown tools and odd roles are not
const round = checkAsk({ today: '2026-11-10', messages: [
  { role: 'user', content: 'How much today?' },
  { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'get_today', input: {} }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"safe_to_spend_today":12.4}' }] },
] });
assert.equal(round.messages.length, 3);
assert.throws(() => checkAsk({ messages: [{ role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'delete_everything', input: {} }] }, { role: 'user', content: 'hi' }] }), /Unexpected/);
assert.throws(() => checkAsk({ messages: [{ role: 'system', content: 'x' }] }), /Unexpected/);
assert.throws(() => checkAsk({ messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }), /last message/);
assert.throws(() => checkAsk({ messages: [] }), /No question/);

const r = readAsk({ stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: 'Let me check.' }, { type: 'tool_use', id: 't2', name: 'try_spending', input: { amount: 80, date: '2026-11-14' } }] });
assert.equal(r.stop_reason, 'tool_use');
assert.deepEqual(r.content.map((b) => b.type), ['text', 'tool_use']);
assert.throws(() => readAsk({ stop_reason: 'refusal', content: [] }), /declined/);
console.log('ask: all checks passed');
