// The request Kitty sends to Claude and how the answer is checked. Kept separate so it can be tested without a network.

const MAX_ALERTS = 20;
const cut = (s, n) => String(s ?? '').slice(0, n);

/** Accept only what Kitty needs, trimmed to size. Throws with a plain message otherwise. */
export function checkBody(b) {
  if (!b || !Array.isArray(b.alerts) || !b.alerts.length) throw new Error('No alerts');
  if (b.alerts.length > MAX_ALERTS) throw new Error(`At most ${MAX_ALERTS} alerts at a time`);
  const alerts = b.alerts.map((a) => ({ id: cut(a.id, 64), app: cut(a.app, 40), title: cut(a.title, 200), text: cut(a.text, 500) }));
  if (alerts.some((a) => !a.id)) throw new Error('Every alert needs an id');
  const cats = (Array.isArray(b.categories) ? b.categories : []).slice(0, 40).map((c) => ({ id: cut(c.id, 32), name: cut(c.name, 40) })).filter((c) => c.id);
  const inTypes = (Array.isArray(b.inTypes) ? b.inTypes : []).slice(0, 20).map((c) => ({ id: cut(c.id, 32), name: cut(c.name, 40) })).filter((c) => c.id);
  if (!cats.length) throw new Error('No categories');
  return { alerts, cats, inTypes };
}

const SYSTEM = `You sort UK bank, card and payment-app notifications for a budgeting app called Kitty.
For each alert decide what it is:
- "spent": money left the person's account (card payment, online payment, Direct Debit, bank charge, cash withdrawal).
- "received": money arrived in the person's account (pay, a payment from someone, a refund).
- "transfer": money moved between the person's own accounts.
- "not_payment": anything else: adverts, offers, job posts, price alerts, warnings, budget summaries, declined or pending card checks, security messages.
A price in an advert or a job post is not a payment.
Name: the shop or payer as people say it, short ("Tesco", "Pret", "HMRC"), not card terminal text ("TESCO STORES 2041", "SQ *"). Empty if none.
Category: for "spent", the id of the closest spending category; for "received", the id of the closest money-in type; otherwise "none".
Confidence: "high" only when the wording leaves no doubt.
Note: at most 12 words, plain UK English, saying why.
Never invent amounts, names or details that are not in the alert.`;

/** The Messages API request body. */
export function buildRequest({ alerts, cats, inTypes }, model) {
  const catIds = [...new Set([...cats.map((c) => c.id), ...inTypes.map((c) => c.id), 'none'])];
  return {
    model,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  kind: { type: 'string', enum: ['spent', 'received', 'transfer', 'not_payment'] },
                  name: { type: 'string' },
                  category: { type: 'string', enum: catIds },
                  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                  note: { type: 'string' },
                },
                required: ['id', 'kind', 'name', 'category', 'confidence', 'note'],
                additionalProperties: false,
              },
            },
          },
          required: ['results'],
          additionalProperties: false,
        },
      },
    },
    messages: [{
      role: 'user',
      content: `Spending categories: ${JSON.stringify(cats)}\nMoney-in types: ${JSON.stringify(inTypes)}\n\nAlerts:\n${JSON.stringify(alerts)}`,
    }],
  };
}

/** Pull the results out of Claude's reply, keeping only ids that were asked about. */
export function readResults(reply, { alerts }) {
  if (reply.stop_reason === 'refusal') throw new Error('The AI declined to sort these');
  const text = (reply.content || []).find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Empty reply from the AI');
  const asked = new Set(alerts.map((a) => a.id));
  const out = JSON.parse(text).results || [];
  return out.filter((r) => asked.has(r.id)).map((r) => ({
    id: r.id, kind: String(r.kind).toLowerCase(), name: cut(r.name, 60), category: String(r.category), confidence: String(r.confidence).toLowerCase(), note: cut(r.note, 120),
  }));
}
