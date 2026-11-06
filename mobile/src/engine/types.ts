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
  sideTaxRate?: number; // percent of side profit to keep back for tax (default 20)
  setupDone: boolean;
  checkEvery: number;
  limits: Record<string, number>;
  dismissed: Record<string, boolean>;
  ai?: { on: boolean; install: string }; // smart sorting with cloud AI: off unless the person turns it on
  learned?: { skip?: Record<string, number>; keep?: Record<string, number> }; // what the person did with alerts Kitty couldn't read, by bank
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
  rate?: number | null;     // debts: interest, % a year, as the lender quotes it (UK APR and EAR both include compounding)
  vary?: boolean | null;    // the person says the amount changes month to month (true) or stays the same (false); unset: Kitty decides from what's been paid
  amtFrom?: string | null;  // payments before this date are left out of what Kitty learns (set when the person accepts a new amount)
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
  fromSide?: boolean; // personal spending paid from side income: off the daily budget, not a business cost
  spread?: boolean;   // a big one-off spread over the rest of the pay month instead of landing on one day (one-off bills always are)
  planned?: number;   // bill payments: what Kitty had set aside for the bill. Any difference from amt goes back to (or comes off) the rest of the pay month
  oneOff?: boolean;   // bill payments: an unusual amount the person said was just this once, so Kitty doesn't learn from it
};

export type Pot = { id: string; name: string; perPay: number; target: number; opening: number; start: string; end?: string; closed?: string };
export type Account = { id: string; name: string; type: 'current' | 'credit'; debtId?: string | null };
export type Checkin = { id: string; at: string; bal: Record<string, number> | null; net: number | null; moved: number; reset?: boolean; adjTx?: string };

export type State = { v: 1; settings: Settings; bills: Bill[]; tx: Tx[]; pots: Pot[]; accounts: Account[]; checkins: Checkin[] };

export type Cycle = { start: string; end: string; days: number };
