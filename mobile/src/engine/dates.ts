// Date helpers. Dates are plain 'YYYY-MM-DD' strings, parsed at noon to dodge clock changes.
const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
export const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const nextDay = (s: string) => ymd(addDays(parse(s), 1));
export const prevDay = (s: string) => ymd(addDays(parse(s), -1));

/** Last weekday of a month (bank holidays not yet handled). */
export function lastWorkingDay(y: number, m: number): Date {
  let d = new Date(y, m + 1, 0, 12);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, -1);
  return d;
}
