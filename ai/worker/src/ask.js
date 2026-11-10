// Ask Crest: Claude answers questions about the person's money using tools the phone runs over its own data.
// This service only relays: it adds the instructions and tool list, passes the conversation on, and keeps nothing.

const cut = (s, n) => String(s ?? '').slice(0, n);
const MAX_MESSAGES = 30;
const MAX_BYTES = 60000;

const PERIOD = { type: 'string', enum: ['today', 'this_pay_month', 'last_pay_month', 'last_7_days', 'last_30_days'], description: 'Which days to look at. Pay months run from payday to the day before the next payday.' };

export const TOOLS = [
  { name: 'get_today', description: "Today's safe-to-spend figure, what's left this pay month, the daily allowance and days until payday.", input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_spending', description: 'Day-to-day spending totals for a period, grouped by category or by shop. Bills and money paid from savings are not included.', input_schema: { type: 'object', properties: { period: PERIOD, by: { type: 'string', enum: ['category', 'shop'] }, filter: { type: 'string', description: 'Optional word to narrow it, such as a shop or category name' } }, required: ['period', 'by'], additionalProperties: false } },
  { name: 'find_payments', description: 'Individual payments in or out matching some text (a shop, a person, a category), newest first, at most 15.', input_schema: { type: 'object', properties: { text: { type: 'string' }, period: PERIOD }, required: ['period'], additionalProperties: false } },
  { name: 'try_spending', description: 'What happens to the daily figure if the person spends an amount on a day: the safe figure that day before and after, and the per-day figure after.', input_schema: { type: 'object', properties: { amount: { type: 'number', description: 'Pounds' }, date: { type: 'string', description: 'YYYY-MM-DD, today or later. Leave out for today.' } }, required: ['amount'], additionalProperties: false } },
  { name: 'upcoming_bills', description: 'Bills not yet paid that are due in the next number of days.', input_schema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 62 } }, required: ['days'], additionalProperties: false } },
  { name: 'get_debts', description: 'Everything owed (cards, loans, overdrafts), monthly payments, rates and when cards and loans clear at current payments.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_forecast', description: 'Where this pay month is heading at the usual pace of day-to-day spending: what is left on payday, or the day the money runs out. Not available in the first week of a pay month.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
];

const SYSTEM = `You are Crest, the budgeting assistant inside one person's own budgeting app in the UK.
The app's main number is "safe to spend today": take-home pay minus bills and savings, spread over the days until payday, recalculated as they spend.
Answer questions about their money using the tools. Every figure you give must come from a tool result: look it up rather than guessing, and use try_spending for "can I afford" questions instead of doing the sums yourself.
Write in plain UK English: short (one to three sentences unless they ask for a list), friendly and direct, amounts like £12.40, dates like Friday 14 November. No em dashes, no exclamation marks, no jargon.
Be honest: if a tool says there isn't enough data, or the question isn't about their money, say so briefly. Don't lecture or moralise; if something looks risky, say what the numbers show and leave the choice to them.
You can't change anything in the app, only look.`;

/** Accept only a conversation of the expected shape, trimmed to size. Throws with a plain message otherwise. */
export function checkAsk(b) {
  if (!b || !Array.isArray(b.messages) || !b.messages.length) throw new Error('No question');
  if (b.messages.length > MAX_MESSAGES) throw new Error('That conversation is too long');
  if (JSON.stringify(b.messages).length > MAX_BYTES) throw new Error('That conversation is too long');
  const names = new Set(TOOLS.map((t) => t.name));
  const block = (x) => {
    if (x.type === 'text') return { type: 'text', text: cut(x.text, 4000) };
    if (x.type === 'tool_use' && names.has(x.name)) return { type: 'tool_use', id: cut(x.id, 80), name: x.name, input: x.input && typeof x.input === 'object' ? x.input : {} };
    if (x.type === 'tool_result') return { type: 'tool_result', tool_use_id: cut(x.tool_use_id, 80), content: cut(x.content, 12000) };
    throw new Error('Unexpected message content');
  };
  const messages = b.messages.map((m) => {
    if (m.role !== 'user' && m.role !== 'assistant') throw new Error('Unexpected message');
    return { role: m.role, content: typeof m.content === 'string' ? cut(m.content, 2000) : (Array.isArray(m.content) ? m.content.map(block) : []) };
  });
  if (messages[messages.length - 1].role !== 'user') throw new Error('The last message must be from you');
  const today = /^\d{4}-\d{2}-\d{2}$/.test(b.today || '') ? b.today : new Date().toISOString().slice(0, 10);
  return { messages, today, currency: cut(b.currency || 'GBP', 3) };
}

/** The Messages API request: instructions, tools and the conversation so far. */
export function buildAsk({ messages, today, currency }, model) {
  const tools = TOOLS.map((t, i) => (i === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t));
  return {
    model,
    max_tokens: 1024,
    system: [{ type: 'text', text: `${SYSTEM}\nToday is ${today}. Their currency is ${currency}.` }],
    tools,
    output_config: { effort: 'low' },
    messages,
  };
}

/** Pass back only text and tool calls. */
export function readAsk(reply) {
  if (reply.stop_reason === 'refusal') throw new Error('Claude declined to answer that');
  return {
    stop_reason: String(reply.stop_reason || 'end_turn'),
    content: (reply.content || []).filter((b) => b.type === 'text' || b.type === 'tool_use')
      .map((b) => (b.type === 'text' ? { type: 'text', text: b.text } : { type: 'tool_use', id: b.id, name: b.name, input: b.input || {} })),
  };
}
