# Kitty

A budgeting app for anyone with an income. The one number that matters is **safe to spend today**: take-home pay, minus bills, minus savings, spread over the days until the next payday, and recalculated as you go.

Owner: Mo. Goal: public release on Google Play first, then the App Store. See `ROADMAP.md` for the plan and `BACKLOG.md` for snags and ideas.

## Product principles

1. **One honest number.** Every figure must make sense on day 1 and on the last day of a cycle. Never extrapolate from too little data. If a number could mislead, explain it or hide it.
2. **Three taps to log.** Opening the app lands on the keypad. Merchant memory fills the category.
3. **For anyone with an income.** Weekly, fortnightly, 4-weekly or monthly pay, any currency. Power features (business/side income, debts) stay out of the way until switched on.
4. **Private by default.** No account and no bank login. Data stays on the device unless the user exports it.
5. **Plain UK English.** Name things the way people say them ("bills", "payday", "safe to spend"), not system terms.

## Current state: web prototype (PWA)

Everything is in `index.html` (markup, CSS, JS in one file, no build step). It's served by GitHub Pages at https://khalifa996.github.io/Kitty/ and installable from Chrome.

- `manifest.webmanifest`, `sw.js`, icons: install + offline. **Bump `CACHE` in `sw.js` on every release.**
- State lives in `localStorage` under `kitty.v1`, as one object `S = {v, settings, bills, tx}`.
- All money is stored as **integer pennies**. Format with `fmt()`/`fmtS()`, parse with `num()`.
- Dates are `YYYY-MM-DD` strings. Parse with `parse()` (noon local time, avoids DST edges).

### Money model (read before touching any maths)

- `cycleOf(date)`: the pay cycle containing a date. Supports `monthly` (on a date), `lastwd` (last working day), `weekly`, `fortnightly`, `fourweekly` (anchored to `settings.payAnchor`).
- `billWindow()`: the period bills are tracked in. Same as the pay cycle for monthly pay, calendar month otherwise.
- `billShare(c)`: monthly bills are shared across non-monthly cycles (`days * 12 / 365`).
- `pot(c)`: money to spend in a cycle = income − bills share − savings. In the first part-way cycle after setup, `settings.opening.pot` replaces it (balance on the day minus bills still to come).
- `flexNet(list)`: spending that counts against the budget. Excludes bill payments and business items, and nets off refunds.
- `safeInfo()`: today's allowance, what's safe now, and the new per-day figure from tomorrow.
- Money in (`IN_CATS[...].fx`): `pay` replaces expected pay, `add` (extra, borrowed, from savings, gift) adds to the cycle's pot via `extraIn()`, `refund` nets off spending, `none` (between my accounts) and `biz` (business) leave the budget alone. Borrowed money can link to a debt (`debtId`) and raises its balance. `matchDebt()` spots borrowing by name.
- Pots (`S.pots`): `perPay` is set aside every payday (`potsAside(c)`, subtracted in `pot(c)`). Spending with `potId` skips the daily budget; top-ups are `potIn` spends; `potBalance()` = opening + top-ups each cycle + moved in − spent.
- Direct Debits: bills with `dd` are paid automatically on the due date by `autoPay()` (runs on every render, from `ddFrom` onwards). Marking one unpaid writes `settings.ddSkip` so it isn't re-paid.
- Categories: base set in `CATS`; custom ones, names, order and hidden list live in settings and are applied by `refreshCats()`. Always use `OUT_CATS` for the visible list.
- Bills are recurring templates (`type`: `bill` | `sub` | `debt`, optional `biz`, optional `balance`). Paying one creates a transaction with `billId`. `settings.prepaid` marks bills that were due before the person started using Kitty.

### Rules

- **Never break existing data.** Add new fields with defaults in `migrate()`. Test against a copy of real data before shipping.
- Business features only show when `settings.sideIncome` is on (`bizOn()`).
- Keep the dark design tokens in `:root`. No new colours outside the token set.
- Copy: short, specific, no jargon, no exclamation marks, no em dashes.

## Testing

`tests/smoke.py` (Python + Playwright) runs a fresh-user setup for monthly and weekly pay and checks for script errors. Run `python3 tests/smoke.py` before every push. Also do a syntax check of the script block with `node --check`.

## Releasing the prototype

Commit to `main` and push. Pages redeploys in about a minute, and installed apps pick it up the next time they open while online.

## Next platform

The prototype is the UX lab. Once the core feels right, port to **Expo / React Native** (Mo's stack from Nestly). The plan is in `ROADMAP.md`, phase 3. Install Expo packages with `npx expo install`, and never run `npm audit fix --force` on an Expo project.
