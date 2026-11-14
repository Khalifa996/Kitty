# Kitty

A budgeting app for anyone with an income. The one number that matters is **safe to spend today**: take-home pay, minus bills, minus savings, spread over the days until the next payday, and recalculated as you go.

On the phone the app is called **Crest** (navy and gold shield, renamed 9 Nov 2026). The repo, code, storage keys (`kitty.v1`), APK names and the Android package id keep the kitty name, so updates install over the old app with its data. Use "Crest" in anything a person reads.

Owner: Mo. **Kitty is Mo's own app** (decided 9 Nov 2026): it's built around how he banks, not for the public. No store release is planned. See `BACKLOG.md` for snags and ideas; `ROADMAP.md` is the older public plan, kept for reference.

## Product principles

1. **One honest number.** Every figure must make sense on day 1 and on the last day of a cycle. Never extrapolate from too little data. If a number could mislead, explain it or hide it.
2. **Three taps to log.** Opening the app lands on the keypad. Merchant memory fills the category.
3. **For anyone with an income.** Weekly, fortnightly, 4-weekly or monthly pay, any currency. Power features (business/side income, debts) stay out of the way until switched on.
4. **Private by default.** No account and no bank login. Data stays on the device unless the user exports it, or turns on Smart sorting (opt-in cloud AI, see below), which sends only the alerts Kitty couldn't sort, with account numbers removed.
5. **Plain UK English.** Name things the way people say them ("bills", "payday", "safe to spend"), not system terms.
6. **Built for Mo.** Fit how he actually banks, as seen in his real alerts and backups (several banks, a business account, Google Wallet). Where a general rule and his setup disagree, his setup wins. His details still never go in the repo: anything specific to him (account names, payees, which account is his business) is learned on the phone and kept in settings, not written into code.

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
- `flexNet(list)`: spending that counts against the budget. Excludes bill payments, pots and anything marked `outside` (paid from savings). Business costs count (it's money spent); `biz` on spending only marks it as a cost for the side income tax figure. In the app, `counts(t)` is the test.
- `safeInfo()`: today's allowance, what's safe now, and the new per-day figure from tomorrow.
- Money in (`IN_CATS[...].fx`): `pay` replaces expected pay, `add` (extra, borrowed, from savings, gift, expenses paid back, paid myself from my business `draw`) adds to the cycle's pot via `extraIn()`, `refund` nets off spending, `none` (between my accounts) leaves the budget alone. Side income (`side`) is money in wherever it lands: the app adds it to the pot (`sideIn`) less a share kept back for tax (`taxKeep`: `sideTaxRate`, default 20%, of side income minus business costs in the cycle). `draw` is for money from a business account Kitty doesn't read; a move from an account Kitty does read is a transfer. In the app, a named account (Monzo business) is asked about once in Review and kept in `settings.bizAccounts`: money in there is side income, spending there is a business cost. Card top-ups of the person's own apps (`isTopUp`) and undone card payments (`reverted`) are moves and refunds, not spending or money in. Kitty doesn't track every move between accounts or savings: it only needs this pay month's money in and what was spent. The web prototype still treats side income as `biz` (left out). Borrowed money can link to a debt (`debtId`) and raises its balance. `matchDebt()` spots borrowing by name.
- Pots (`S.pots`): `perPay` is set aside every payday (`potsAside(c)`, subtracted in `pot(c)`). Spending with `potId` skips the daily budget; top-ups are `potIn` spends; `potBalance()` = opening + top-ups each cycle + moved in − spent.
- Direct Debits: bills with `dd` are paid automatically on the due date by `autoPay()` (runs on every render, from `ddFrom` onwards). Marking one unpaid writes `settings.ddSkip` so it isn't re-paid.
- Categories: base set in `CATS`; custom ones, names, order and hidden list live in settings and are applied by `refreshCats()`. Always use `OUT_CATS` for the visible list.
- Bills are recurring templates (`type`: `bill` | `sub` | `debt`, optional `biz`, optional `balance` and `rate` (% a year) for debts; with a rate, `debtLeft`/`debtFree` in the app add interest). Paying one creates a transaction with `billId`. `settings.prepaid` marks bills that were due before the person started using Kitty.

### Rules

- **This repo is public.** Never commit real names, account numbers, amounts tied to a person, or raw alert dumps. Change names and digits before turning a real alert into a test. Commit as `Mo <Khalifa996@users.noreply.github.com>`, never a personal email. (History was scrubbed on 29 Oct 2026.)
- **Never break existing data.** Add new fields with defaults in `migrate()`. Test against a copy of real data before shipping.
- Business features only show when `settings.sideIncome` is on (`bizOn()`).
- Keep the dark design tokens in `:root`. No new colours outside the token set.
- Copy: short, specific, no jargon, no exclamation marks, no em dashes.

## Testing

`tests/smoke.py` (Python + Playwright) runs a fresh-user setup for monthly and weekly pay and checks for script errors. Run `python3 tests/smoke.py` before every push. Also do a syntax check of the script block with `node --check`.

## Releasing the prototype

Commit to `main` and push. Pages redeploys in about a minute, and installed apps pick it up the next time they open while online.

## Native app (mobile/)

Expo SDK 58, TypeScript. Being rebuilt from the prototype screen by screen.

- `src/engine/`: the money model as pure functions (`budget.ts`), same data shape as the prototype (`types.ts`) so a prototype backup imports as-is. `today` is always passed in. Tests in `*.test.ts`.
- `src/parse/bankAlerts.ts`: turns bank notifications into entries. Built from real Revolut, Barclays, Monzo and Google Wallet alerts; other UK banks use general rules until testers send real (anonymised) examples. Every rule has a test. Duplicate payments (bank + Google Wallet) are merged.
- `modules/kitty-notifications/`: local Expo module (Kotlin). `KittyNotificationListener` stores alerts from bank apps only in SharedPreferences; JS reads them with `getCaptured()`. Other apps that post money alerts are noted by package name only, never content; Review offers to read them and only the person can turn that on (`setExtraApps`). Chat, text, email, social and marketplace apps can never be turned on (`NEVER` in `CaptureStore.kt`, `neverRead` in `bankAlerts.ts`), and anything kept from them is deleted when the app opens. The bank list lives in both `CaptureStore.kt` and `bankAlerts.ts`.
- Screens (0.6): `src/screens/` Log (keypad, fits one screen), Review (captured alerts → one tap to add, or "Same one" to merge with a hand-logged entry), Activity (tap or swipe right to edit, swipe left to delete), Plan (Bills and Pots; `engine/bills.ts`), Insights (a day, a pay month; `dayInfo`/`cycleSummary` in the engine), More (behind the button on Plan: import a backup, alert access, backups). New people get `SetupScreen` (`engine/setup.ts`). State lives in `src/store/store.ts` (one JSON document, saved with `expo-sqlite/kv-store` on the phone, `localStorage` in the browser preview), shared with the background brain and handed to screens by `KittyState.tsx`. Direct Debits are ticked off when the app opens or the brain runs. Alerts Crest is sure about (`isSure` in `capture/toEntry.ts`) are added by the brain once settled and marked `autoAdded`; Review lists them to check (`settings.autoAdd`, `settings.autoSeen`).
- Spending detail (`engine/spending.ts`): Insights shows categories or shops for a pay month; tapping a category shows its last four pay months, the usual amount (full months only) and an optional limit (`settings.catLimits`, pennies a pay month; "running fast" only after a week). The prototype's `settings.limits` are separate and unused by the app.
- Debts (`engine/debts.ts`, Plan → Debts): debt bills with a balance, plus overdrafts (`S.overdrafts`, updated by hand with a `history`). `Bill.history` keeps earlier balances so the total owed can be shown at the start of each pay month; a point is left out if anything owed now has no figure for it.
- Background brain (`src/brain/`): the same TypeScript runs whether the app is open or not. `KittyNotificationListener` starts `CrestBrainService` (a `HeadlessJsTaskService`, task "CrestBrain" registered in `index.ts`) 2.5 s after a bank alert; `task.ts` applies notification button taps, adds settled sure alerts (`settleMinutes`: 2 min for a bank's own card payment, 20 for money sent or received, 65 for Google Wallet), posts the after-payment message (`noticeFor`), refreshes the widget, tile, status bar figure and morning message from the projected data (`projected`: sure alerts counted before they settle), and sets an alarm for the next settle time or just after midnight. `brain.ts` is pure and tested. State lives in `src/store/store.ts`, one copy shared by the app and the brain (same JS runtime), so never write the kv-store document anywhere else.
- After-payment message (`PaymentNotices.kt`): silent heads-up on the "After each payment" channel with up to three buttons; a tap is queued in SharedPreferences (`takeActions`) and applied by the brain (`applyAct`). `settings.afterPay` (on unless false).
- Widget, Quick Settings tile, status bar (`Surfaces.kt`): RemoteViews widget `CrestWidget` and `CrestTile` read a ready-written snapshot (`setSurfaces`); `settings.ongoing` adds an ongoing notification that asks to be an Android 16 Live Update (called by reflection).
- Morning message (`engine/morning.ts`, `Morning.kt`): the brain hands the next morning's text to the phone whenever it runs; an inexact alarm posts it at `settings.morning.hour`, notes alerts not yet counted, and warns if the listener has heard nothing for a day. The listener sets the alarm again after a restart.
- Ask Crest (`src/ai/ask.ts`, `screens/AskSheet.tsx`, worker `/v1/ask` in `ai/worker/src/ask.js`): Claude Haiku with tools that run on the phone (`runTool`): only the figures a question needs leave the phone. Uses the Smart sorting switch and install id.
- Forecast and recurring (`engine/forecast.ts`, `engine/recurring.ts`): "at your usual pace" only after 7 days of the pay month (also on the home card when it runs short); monthly payments not yet bills are offered in Review.
- Checks (`engine/checks.ts`, shown in Activity one at a time): hand-logged vs alert (`likelyDuplicates`), one bank's alert told twice (`alertTwins`), own-account top-ups counted as spending (`topUpsCounted`). Refunds of £100 or more are asked about, not auto-added.
- Every build also exports a browser version and screenshots each screen with made-up sample data (`scripts/shots.mjs`, `sample-state.json`, `sample-alerts.json`). The pictures land on the `ci-reports` branch under `shots/`. Check them before telling Mo a build is ready.
- Look and feel (0.14): colours only from `C` and the gradient pairs `G` in `ui/theme.ts`. `ui/motion.tsx` has `Pop` (springy press with a haptic, used by `Btn`, `Chip`, keys and tabs), `Rise` (cards float in), `CountUp`, `GrowBar`, `Bump`, `Toggle` and `feel` (expo-haptics, phone only). `ui/Glow.tsx` has `GradientCard`, `Ring` and `Donut` (react-native-svg). Use `native` from motion for `useNativeDriver`, since the browser preview has no native driver. Screenshots wait 1.2 s after each step so animations finish.
- Icons: `src/ui/icons.ts` holds the web app's Lucide shapes; draw them with `<Icon>` (react-native-svg) or `<CatIcon>` for a tinted circle. Categories carry an icon id (`i`).
- New packages: add them to `deps.txt`; CI installs matching versions with `npx expo install` and commits the lock file.
- Builds run on GitHub Actions (`.github/workflows/android.yml`): install, type check, Jest, prebuild, Gradle, then the APK is published to Releases. A report of each build is pushed to the `ci-reports` branch (`android.md`).
- Smart sorting (opt-in cloud AI): `src/ai/` on the phone (`redact.ts` strips account numbers, sort codes and emails; `useSmartSort` sends at most 20 unsorted alerts at a time and caches answers). `ai/worker/` is a Cloudflare Worker that calls Claude Haiku 5.5 with a JSON schema and keeps nothing. `.github/workflows/ai-worker.yml` deploys it when the repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY` and `KITTY_AI_KEY` are set, writes its address to `ai/worker/url.txt`, and starts an app build; the app gets the address and key as `EXPO_PUBLIC_KITTY_AI_URL` / `EXPO_PUBLIC_KITTY_AI_KEY`. Off by default; the More screen explains exactly what is sent. Declare it in the Play Data safety form (shared with a service provider, only when switched on). Keep a monthly spend limit on the Anthropic account.
- Test APKs are signed with `credentials/sideload.keystore` (debug passwords, test builds only). They check GitHub Releases for a newer build (`src/update/useUpdate.ts`, at most every six hours, nothing about the person is sent) and show an Update banner. CI sets `EXPO_PUBLIC_KITTY_BUILD` and `EXPO_PUBLIC_KITTY_RELEASES`; a Play Store build must leave them empty.
- npm is not reachable from Claude's workspace, so run tests locally with `node --experimental-strip-types` and a small shim, and let CI do the real install.
- Sideloaded apps on Android 13+ need "Allow restricted settings" (App info → ⋮) before notification access can be granted.

## Next platform

The prototype is the UX lab. Once the core feels right, port to **Expo / React Native** (Mo's stack from Nestly). The plan is in `ROADMAP.md`, phase 3. Install Expo packages with `npx expo install`, and never run `npm audit fix --force` on an Expo project.
