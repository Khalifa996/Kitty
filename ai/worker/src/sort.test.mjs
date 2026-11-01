// node ai/worker/src/sort.test.mjs
import assert from 'node:assert/strict';
import { buildRequest, checkBody, readResults } from './sort.js';

const body = checkBody({ alerts: [{ id: 'a1', app: 'Revolut', title: 'Revolut', text: 'A transaction of £12 is on hold' }, { id: 'a2', app: 'Airtasker', title: 'Task in Hackney', text: 'Assemble a bed - £70' }],
  categories: [{ id: 'food', name: 'Eating out' }, { id: 'groceries', name: 'Groceries' }], inTypes: [{ id: 'extra', name: 'Extra income' }] });
assert.equal(body.alerts.length, 2);
assert.throws(() => checkBody({ alerts: [] }), /No alerts/);
assert.throws(() => checkBody({ alerts: Array.from({ length: 21 }, (_, i) => ({ id: 'x' + i })), categories: [{ id: 'a' }] }), /At most 20/);

const req = buildRequest(body, 'claude-haiku-5-5');
assert.equal(req.model, 'claude-haiku-5-5');
assert.equal(req.output_config.effort, 'low');
assert.deepEqual(req.output_config.format.schema.properties.results.items.properties.category.enum, ['food', 'groceries', 'extra', 'none']);
assert.match(req.messages[0].content, /Assemble a bed/);

const reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ results: [
  { id: 'a1', kind: 'spent', name: '', category: 'none', confidence: 'low', note: 'A pending card payment' },
  { id: 'a2', kind: 'not_payment', name: '', category: 'none', confidence: 'high', note: 'A job advert, not money moving' },
  { id: 'zz', kind: 'spent', name: 'Evil', category: 'food', confidence: 'high', note: 'not asked' },
] }) }] };
const r = readResults(reply, body);
assert.equal(r.length, 2);
assert.equal(r[1].kind, 'not_payment');
assert.throws(() => readResults({ stop_reason: 'refusal', content: [] }, body), /declined/);
console.log('ai worker: all checks passed');
