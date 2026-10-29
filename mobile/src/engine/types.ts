// Kitty's data, in the same shape as the web prototype so a backup can be imported as-is.
// All money is integer pennies. Dates are 'YYYY-MM-DD', times 'HH:MM'.

export type PayFreq = 'monthly' | 'lastwd' | 'weekly' | 'fortnightly' | 'fourweekly';

export type Settings = {
  currency: string;
  payFreq: PayFreq;
  payday: number;
  payAnchor: string | null;
  income: number;
  savings: number;
  sideIncome: boolean;
  setupDone: boolean;
  checkEvery: number;
  limits: Record<string, number>;
  dismissed: Record<string, boolean>;
  opening?: { start: string; date: string; pot: number } | null;
  prepaid?: Record<string, string>;
  ddSkip?: Record<string, boolean>;
  customCats?: { id: string; n: string; i: string; c: string }[];
  catOrder?: string[];
  hiddenCats?: string[];
  catNames?: Record<string, string>;
  [k: string]: unknown;
};

export type Bill = {
  id: string;
  name: string;
  amt: number;
  day: number;
  type: 'bill' | 'sub' | 'debt';
  sub?: string;
  biz?: boolean;
  dd?: boolean;
  ddFrom?: string;
  balance?: number | null;
  balanceAt?: string | null;
};

export type Tx = {
  id: string;
  kind: 'out' | 'in';
  amt: number;
  cat: string;
  sub?: string | null;
  merchant: string;
  note: string;
  date: string;
  time: string;
  biz: boolean;
  billId: string | null;
  refundCat?: string;
  debtId?: string;
  potId?: string;
  potIn?: string;
  potOut?: string;
  auto?: boolean;
  checkin?: boolean;
  since?: string;
  example?: boolean;
  source?: string; // e.g. 'alert' when captured from a bank notification
  bank?: string;   // which bank's alert it came from
};

export type Pot = { id: string; name: string; perPay: number; target: number; opening: number; start: string; end?: string; closed?: string };
export type Account = { id: string; name: string; type: 'current' | 'credit'; debtId?: string | null };
export type Checkin = { id: string; at: string; bal: Record<string, number> | null; net: number | null; moved: number; reset?: boolean; adjTx?: string };

export type State = { v: 1; settings: Settings; bills: Bill[]; tx: Tx[]; pots: Pot[]; accounts: Account[]; checkins: Checkin[] };

export type Cycle = { start: string; end: string; days: number };
