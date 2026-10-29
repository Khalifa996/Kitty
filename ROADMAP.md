# Kitty roadmap

From a prototype on Mo's phone to a public app. Each phase ends with something real people can use.

## Phase 1: Prototype for everyone ✅ (Oct 2026)
- First-run setup: currency, how often you're paid, take-home pay, common bills, savings
- Weekly, fortnightly, 4-weekly, monthly and last-working-day pay
- Starting part-way through a cycle: asks for money you have now, marks earlier bills as paid
- Side income / self-employed mode is optional; business features stay hidden until it's on
- Debts with balances and payoff dates; bills, subscriptions, business costs
- Honest forecasts: no extrapolation until there's enough data; typical (median) day, not average

## Phase 2: Core complete (prototype, Nov 2026)
Goal: a stranger can use it for a month without help and without hitting a wrong number.
- Custom categories (add, rename, reorder, hide)
- Bill frequencies: weekly, 4-weekly, quarterly, yearly (TV licence, car insurance)
- Variable income mode: budget from money received, not an expected figure
- More than one income source (two jobs, partner's contribution, benefits)
- Split a transaction across categories; recurring income
- Proper backup to a file, not just copy and paste
- Accessibility pass: screen reader labels, contrast, text size
- 5 to 10 friends and family testing the prototype, feedback into `BACKLOG.md`

## Phase 2b: Less logging (Oct to Nov 2026)
- ✅ Balance check-ins in the prototype: one number instead of every spend
- ✅ Android app reads payment alerts from Barclays, Revolut, Monzo, Starling, NatWest and Google Wallet
- ✅ App 0.2: Review screen, one tap to add a captured payment (category from your history or a list of common UK shops)
- Next: Bills, Pots and Insights screens in the app, then setup for new users
- Later: add captured payments automatically, with an undo
- Next: share a screenshot of a banking app to log several payments at once (on-device text reading)
- iPhone: Wallet tap-to-pay automation through Shortcuts

## Phase 3: Native app (Expo / React Native, started Oct 2026)
- Port the screens one by one; keep the money logic as a separate, unit-tested module (Jest)
- Local database (expo-sqlite) with migrations
- Biometric / PIN lock (expo-local-authentication)
- Bill reminders (expo-notifications)
- Home-screen widget showing "safe to spend today", with one-tap logging (Android first)
- Crash reporting, opt-in only
- Import data from the prototype (backup file)

## Phase 4: Closed testing and store prep (Feb 2027)
- Google Play Console personal account: US$25 one-off
- **New personal accounts must run a closed test with at least 12 testers, opted in for 14 days in a row, before production access.** Recruit 15 to 20 people to be safe
- Privacy policy page (GitHub Pages), Play **Data safety** form, **Financial features** declaration (budgeting app, no loans)
- Store listing: name check (search Play Store and UK trademarks for "Kitty"), icon, screenshots, short and full description
- iOS: Apple Developer Program US$99 a year; TestFlight beta

## Phase 5: Launch and grow (spring 2027 onwards)
- Public release on Google Play, then the App Store
- Decide the business model: free, one-off unlock, or a Pro subscription (bank sync, sharing, cloud backup)
- Open Banking import (needs an FCA-authorised provider; this is a bigger compliance step)
- Shared budgets for couples and housemates
- Cloud sync and backup (opt-in, encrypted)

## Open decisions
- Final name (Kitty is the working name)
- Business model, which affects what goes into the free tier
- UK only at launch, or UK plus Ireland, Australia and others (the currency setting already allows it)
