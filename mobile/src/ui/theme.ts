// Kitty's look, matching the web prototype's dark tokens. Use these, never raw colours.
export const C = {
  bg: '#0A0C0F',
  surface: '#15181D',
  surface2: '#1F232A',
  line: '#272C34',
  fg: '#F1F3F6',
  muted: '#8D95A1',
  faint: '#59606B',
  gold: '#F2C14E',
  goldInk: '#1C1505',
  good: '#3DD68C',
  warn: '#FF9A3D',
  bad: '#FF5C6C',
  pot: '#3DD6B0',
  bill: '#A78BFA',
} as const;

export const R = { card: 18, row: 14, btn: 12, pill: 999 } as const;

export const T = {
  h1: { color: C.fg, fontSize: 28, fontWeight: '700' as const },
  h2: { color: C.fg, fontSize: 17, fontWeight: '700' as const },
  label: { color: C.muted, fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  body: { color: C.fg, fontSize: 15 },
  hint: { color: C.muted, fontSize: 13.5, lineHeight: 19 },
  num: { fontVariant: ['tabular-nums' as const] },
};

const SYMBOLS: Record<string, string> = { GBP: '£', EUR: '€', USD: '$', CAD: '$', AUD: '$', NZD: '$', IEP: '€', ZAR: 'R', INR: '₹', NGN: '₦', AED: 'AED ' };

export const symbol = (currency = 'GBP') => SYMBOLS[currency] || '£';

/** Pennies to "£1,234.56". */
export function money(p: number, currency = 'GBP', dp = 2): string {
  const v = Math.abs(p) / 100;
  return (p < 0 ? '−' : '') + (SYMBOLS[currency] || '£') + v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
/** Whole pounds when it's a round number or a big one. */
export const moneyS = (p: number, currency = 'GBP') => money(p, currency, Math.abs(p) >= 100000 || p % 100 === 0 ? 0 : 2);
