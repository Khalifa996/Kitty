// Spending categories, matching the web prototype. Custom ones live in settings.
import type { Settings } from './types';

export type Cat = { id: string; n: string; c: string };

export const BASE_CATS: Cat[] = [
  { id: 'food', n: 'Eating out', c: '#FF8A5C' },
  { id: 'groceries', n: 'Groceries', c: '#8BD45E' },
  { id: 'transport', n: 'Transport', c: '#4FC3F7' },
  { id: 'shopping', n: 'Shopping', c: '#D59BFF' },
  { id: 'fun', n: 'Going out', c: '#FF6F91' },
  { id: 'health', n: 'Health', c: '#3DD6B0' },
  { id: 'home', n: 'Home', c: '#E0B98C' },
  { id: 'personal', n: 'Personal', c: '#9DB4FF' },
  { id: 'bills', n: 'One-off bill', c: '#A78BFA' },
  { id: 'other', n: 'Other', c: '#A0A7B4' },
];

/** Visible categories in the person's order, with their names and custom additions. */
export function categories(st: Settings): Cat[] {
  const names = st.catNames || {}, hidden = new Set(st.hiddenCats || []), order = st.catOrder || [];
  const all: Cat[] = [
    ...BASE_CATS.map((c) => ({ ...c, n: names[c.id] || c.n })),
    ...(st.customCats || []).map((c) => ({ id: c.id, n: c.n, c: c.c })),
  ];
  const byId = new Map(all.map((c) => [c.id, c]));
  const ids = [...order.filter((k) => byId.has(k)), ...all.map((c) => c.id).filter((k) => !order.includes(k))];
  return ids.filter((k) => !hidden.has(k)).map((k) => byId.get(k) as Cat);
}

export const catName = (st: Settings, id: string) => categories(st).find((c) => c.id === id)?.n || BASE_CATS.find((c) => c.id === id)?.n || 'Other';

/** Kinds of money in, and what each does to the budget (matches the web app). */
export const IN_TYPES: (Cat & { long: string })[] = [
  { id: 'salary', n: 'Pay', long: 'Pay', c: '#3DD68C' },
  { id: 'extra', n: 'Extra', long: 'Extra income', c: '#3DD68C' },
  { id: 'borrowed', n: 'Borrowed', long: 'Borrowed', c: '#FF9A3D' },
  { id: 'savings', n: 'Savings', long: 'From savings', c: '#3DD68C' },
  { id: 'refund', n: 'Refund', long: 'Refund', c: '#3DD68C' },
  { id: 'expenses', n: 'Expenses', long: 'Expenses paid back', c: '#3DD68C' },
  { id: 'gift', n: 'Gift', long: 'Gift', c: '#3DD68C' },
  { id: 'transfer', n: 'Transfer', long: 'Between my accounts', c: '#8D95A1' },
  { id: 'side', n: 'Business', long: 'Business income', c: '#F2C14E' },
];
export const inTypes = (st: Settings) => IN_TYPES.filter((t) => t.id !== 'side' || st.sideIncome);
export const inName = (id: string) => IN_TYPES.find((t) => t.id === id)?.long || 'Money in';
