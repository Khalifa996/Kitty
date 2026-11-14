# Kitty backlog

Snags and improvements, worst first. Add new ones at the top of the right section with the date and where they were seen. Move fixed items to the changelog at the bottom.

Priority: **P1** wrong number or lost data · **P2** confusing or slow · **P3** nice to have

Since 9 Nov 2026 Kitty is Mo's own app, built around how he banks. Items that only matter for a public release are parked at the end.

## Snags
| Pri | Found | Snag |
|---|---|---|
| P1 | 10 Nov | Background brain not yet seen on a real phone: check the after-payment message arrives with Crest closed, and that Samsung doesn't stop it |
| P2 | 10 Nov | Next for complete data: Monzo's own API through the Worker (real balances, pots and payee names); Emma Pro's live Google Sheet for the other banks |
| P3 | 10 Nov | Shop logos (logo.dev free plan needs a key), Gemini Nano on the phone as a private second opinion, mileage at HMRC rates |
| P2 | 9 Nov | A Direct Debit the bank reverses (bounced, or claimed back) is skipped, but the bill stays ticked off as paid |
| P2 | 9 Nov | Monzo's wording for an undone card payment isn't known yet. If it reads like "£6.40 from TfL", it comes in as money in to check, not as an undo |
| P2 | 9 Nov | Business account: answering "It isn't" in More doesn't change entries already counted as side income (fix them in Activity) |
| P2 | 7 Nov | A balance check now and then ("What's in your accounts?") to catch anything no alert covered. The web prototype has check-ins; bring them across once testers have tried 0.10 |
| P2 | 7 Nov | The web prototype still leaves side income out of the budget and doesn't know `outside` or `spread` |
| P2 | 7 Nov | Big one-offs on the keypad: Review asks, Activity has the switches, but the keypad doesn't offer "From savings" yet |
| P2 | 7 Nov | Credit card spending (seen through Google Wallet) counts against the daily budget, and the card's monthly repayment is a bill too. Fine for now, but think about cards paid in full |
| P2 | 2 Nov | The web prototype doesn't know about spread entries or interest on debts yet |
| P2 | 2 Nov | Day view: "£X over" gives no reason. Name the biggest entry and what it does to the days left |
| P2 | 2 Nov | Entries named "Payment sent", "Money in" or just the category mean nothing later. Use the payee in the alert, or ask once in Review |
| P2 | 2 Nov | Cash withdrawals are named after the machine ("Ec East Ham GBP"). Call them "Cash · <place>" |
| P2 | 2 Nov | Plan: paid bills make a long list (fold into one line), and each row shows the due date in the box and the paid date underneath |
| P1 | 29 Oct | App: balance check-ins, Settings (change pay, categories, side income switch) still only in the web app |
| P2 | 1 Nov | On-device AI (Gemini Nano, which the Z Fold8 has): same Smart sorting without anything leaving the phone |
| P2 | 1 Nov | Cash: a Cash pot for a stash at home (withdrawal tops it up, spending from it skips the daily budget) |
| P2 | 29 Oct | App: change an entry's date; notes; Business switch; pay from a pot |
| P2 | 29 Oct | Work expenses: mark a spend as "I'll get this back" so it stays off the daily budget until the reimbursement arrives |
| P2 | 28 Oct | Payments to your own accounts by bank transfer (not card top-ups, not Monzo named accounts) can still show as spending. Let a payee be marked as "one of my accounts" |
| P2 | 27 Oct | Log screen in Received mode is tall on small phones (two rows of types plus the debt picker) |
| P3 | 27 Oct | Closed pots disappear completely. Add a "closed pots" list |
| P2 | 27 Oct | "Last working day" pay ignores bank holidays (UK employers usually pay the day before) |
| P2 | 27 Oct | With non-monthly pay, bills track by calendar month. A bill paid early on the 30th counts for the wrong month |
| P2 | 27 Oct | Turning side income off leaves old business items excluded from the budget with no way to see them |
| P3 | 27 Oct | Date input shows the phone's own format (fine on UK phones, US format elsewhere) |

## Improvements
| Pri | Idea |
|---|---|
| P1 | Variable income mode (budget from money received) |
| P2 | Bill frequencies other than monthly |
| P2 | Multiple income sources |
| P2 | Backup to a file; restore from a file |
| P2 | Split one payment across categories |
| P2 | "Spend less on X" nudges based on the cycle so far, without nagging |
| P3 | Search Activity by date range and amount |
| P3 | Haptics and sound settings |
| P3 | Light theme |

## Public release (parked 9 Nov)
| Pri | Idea |
|---|---|
| P1 | Setup that fits each person: other income sources, regular spending, which banks, fixed amounts (ROADMAP phase 2c) |
| P1 | Harden the AI service (per-install rate limits, Play Integrity check), privacy policy and Play Data safety form |
| P1 | Testers for the Play closed test, and their anonymised alerts to confirm each bank's wording |
| P2 | Banks that only send texts: a sender-only option to read texts from named bank senders and nothing else |
| P3 | Debt and business suggestions only recognise UK lender and insurer names |

## Changelog
**App 0.15.1, 14 Nov 2026: refunds give back what they refund**
- A refund is linked to the payment it gives back (same shop if named, otherwise the exact amount, within 90 days), so it comes off that category in Insights and gets that payment's name. Refunds already in are linked when the app opens. An exact match is counted straight away, even if it's big
- Activity: "Money back for" on a refund to link it by hand

**App 0.15, 14 Nov 2026: fixes from Mo's 14 Nov screenshots**
- Home card: once a week of the pay month has gone, if your usual pace would run out before payday it says so, in amber, instead of only in Insights
- Insights: "more than the pay month before" only when Crest has all of the month before (it was comparing with an empty month); the daily chart shows each day's budget as a mark; the donut says "less refunds" when refunds come off; Personal is a clearer blue
- Activity: "Charged twice?" when one bank sends two alerts for the same shop and amount minutes apart; "A move, not spending?" for card top-ups of your own Revolut or Monzo that went in as spending
- A refund of £100 or more is asked about (Refund, Extra income, My own account) instead of counted straight away, since it lifts every day left
- Plan: when every bill is paid, "After payday" lists what comes round next
- Review: anything without an amount goes with the notices; scooter adverts are adverts; copy fits adding by itself
- TfL has one name whichever bank reports it, so Shops adds it up together

**App 0.14, 11 Nov 2026: more colour and life**
- Today's figure sits on a colour card that shifts green, gold or red with the day, rolls to the new amount, and fills a bar as you spend
- Buttons, chips, keys and tabs spring under your thumb, with a light buzz; cards float in; a tick slides up when something's saved
- Insights: a ring for how much of the day's budget is used, a donut for where the pay month went, bars that grow
- Debts: a warm card for what you owe, rolling to the figure. Review: a calm "All caught up" card
- Settings in More are proper on/off switches (After each payment, status bar, adding sure payments by itself)
- Ask Crest's ideas are full rows, so none are cut off
- Fixes: Monzo business shop names with a curly apostrophe ("You’ve spent…") and ". Travel charge" tails; PayPal's "Your purchase from Google" names the shop; older entries' names tidied ("GBP" and store numbers); one-off bills no longer show as keypad shortcuts

**App 0.13, 10 Nov 2026: Crest works in the background**
- Payments are counted the moment the bank's alert arrives, even with Crest closed (the app's own brain runs in the background)
- A message a few seconds after each payment: what it was, its category and what's left today, with buttons to change the category, mark it as business or leave it out. Money in asks what it is; big one-offs ask whether to spread them
- Home and cover screen widget with today's figure, a Quick Settings tile, and an optional status bar figure (an Android 16 Live Update where Samsung allows it)
- The morning message is always current and warns if Crest has stopped hearing notifications
- Ask Crest: questions in plain words ("Can I afford £80 on Friday?"), answered by Claude from figures worked out on the phone
- Insights says where the pay month is heading at your usual pace, after the first week
- Review spots monthly payments that aren't bills yet and makes them bills in one tap
- Cleaner shop names (SumUp, store numbers, "GBP" on the end)
- More: battery check so Samsung doesn't put Crest to sleep

**App 0.12, 9 Nov 2026: Crest, and the best of Emma**
- The app is called Crest now, with a navy and gold shield icon (themed icon too). Your data and updates carry on as before
- Insights: "Where it went" shows categories or shops. Tap a category for its last four pay months, what's usual, and an optional limit ("£X left of £Y", "running fast" once a week has gone by). Tap a shop for its payments
- Plan has a Debts tab: everything owed (cards, loans and overdrafts), when cards and loans clear, and the total at the start of each pay month
- Morning message: a notification at 7, 8 or 9am with what's safe to spend that day, bills going out and any category running fast. Turn it on in More

**App 0.11, 9 Nov 2026: built for Mo**
- Kitty is Mo's own app now (principle 6: where a general rule and his setup disagree, his setup wins; his details still stay on the phone)
- Review asks once whether a named account (a Monzo business account) is your business. Yes: money in there is side income and spending there a business cost, for what's already in too. More shows it, with "It isn't" to undo
- Topping up another of your own accounts by card (Barclays card to "Revolut**1234*", Monzo, Starling, Wise, Chip and others) is a move, not spending
- A card payment the bank undoes ("Card payment reverted") comes back off your spending if it was counted. If neither was added yet, both stay out
- Google Wallet's copy of money coming back (a refund, or a £1 card check) is skipped when the card's bank sends its own alert
- Monzo business shop names drop the running total ("You've spent £41.85 today") the bank adds after them
- An unnamed Direct Debit is only matched to a bill if it's within 50p or 5% (79p off a £10.99 bill is no longer taken for it)
- Shops Kitty added by itself with a guessed category are sent to Smart sorting (when it's on) to pick the category. Guessed categories don't teach Kitty about a shop until you check them ("Looks right") or change them

**App 0.10, 7 Nov 2026: simpler and for everyone**
- Principle 6: build for everyone, test on Mo. Kitty doesn't try to track every move between accounts. It needs this pay month's money in and what was spent
- Side income is money in, wherever it lands, with a share kept back for tax (20% by default, of income minus business costs). Business costs count as spending; marking one only lowers the tax kept back. "Paid myself" stays for business accounts Kitty can't read
- No more guessing a business account from its name. A second account is like any other, and money from one Kitty has seen into another is a move between your accounts (also paired when both are in the same bank app)
- A big spend that's unusual for that name (three days' budget and at least £75) waits in Review: "This month" spreads it, "From savings" leaves it out. Activity has "Paid from savings, leave it out" and "Business cost"
- Activity spots something you added by hand that a bank alert added too: "Same payment twice?" with Keep both or Remove mine
- Typing a name on the keypad that Kitty already picks up from your bank alerts says so, so it isn't logged twice
- The listener catches up on bank notifications still in the shade after a gap, and asks Android to reconnect if it was dropped. Review says when a bank that usually sends alerts has gone quiet for three days
- 0.10.1: Insights' pay month counts side income in "Money in" and no longer says it's kept out of the budget

**App 0.9.1, 7 Nov 2026: Monzo Business**
- With more than one Monzo account, Monzo puts the account's name in the title ("Acme Ltd") and "£75.20 from Jobsite" in the text. Kitty read that as spending at a shop called Acme Ltd. It now reads money in and spending properly, and never takes the account name for a shop or payer
- A business account (side income on and a business-like name, or one that has had side income before): money in is side income and spending is a business cost, both kept out of the daily budget until you pay yourself. Review and Activity show which account

**App 0.9, 7 Nov 2026: Kitty adds what it's sure about**
- Payments Kitty is sure about go in by themselves once they've settled (20 minutes, an hour for Google Wallet, so transfers and twins can pair up first). Spending goes in even with a guessed category. Money in only when Kitty knows what it is. Cash, new Direct Debits, bill amount changes, unclear alerts and anything that looks logged already still wait in Review. More has "Ask me first" to turn it off
- Review shows "Kitty added N payments" to check: tap one to change its category or take it out, or "Looks right"
- Google Wallet's extra alert for a card whose bank sends its own is skipped as a likely hold (VOI Technology AB £5.00 next to Barclays' £5.00 and £3.24). It can still be added from "not added"
- A bank alert without a shop name takes the name from Google Wallet's copy
- When the pay month's money has gone, Log shows how far over the month is and when payday is, instead of a minus figure per day

**App 0.8.3, 7 Nov 2026: update notice, fewer double counts**
- Test builds check GitHub for a newer build and show "A newer Kitty is ready" with an Update button, so nobody tests an old version
- A Google Wallet alert is matched to its bank's alert even when the amounts differ by a few pence or the bank is up to an hour behind, as long as it's the same card's bank
- TfL charges that arrive before 7am go on the day of travel

**App 0.8.2, 2 Nov 2026: big one-offs**
- One-off bills (a surprise fee, a fine) come off every day left in the pay month instead of putting one day hundreds of pounds in the red. Activity can spread any big spend the same way. The Day view says what it did to each day
- Money in marked Borrowed can be linked to a debt in Activity, so the debt's balance goes up by itself
- An unknown Direct Debit keeps its category button, so a fuel card can go in as Transport

**App 0.8.1, 2 Nov 2026: Direct Debits without a name**
- Barclays doesn't say who a Direct Debit is paid to. Kitty now matches one to a bill due in the last five days with a close amount (a Sunday bill taken on Monday, an energy bill a little under the usual), and offers to update what it ticked off
- A Direct Debit that matches nothing gets "Make it a bill": name it once and it goes into Plan, paid, and is expected every month. "One-off" and "Skip" are still there. These stay out of Add all and aren't sent to Smart sorting
- Day view: two or more bills fold into one line, and money moved between your own accounts is shown apart from money that came in

**App 0.8, 2 Nov 2026: debts with interest, paying yourself**
- Debts can have an interest rate. Plan then gives the real payoff date and the interest it costs, says plainly when a payment doesn't cover the interest, and shows what moving a payment from a debt that's about to finish would do
- New money-in type "Paid myself" for money moved from your business to your own account: it adds to your daily budget and counts against side income. Once you've marked a payer, Kitty remembers it, even when the alert pairs up as a move between accounts
- "Paid from side income" is gone (older entries keep it and can turn it off). Insights shows what you've paid yourself and what's still yours to take after tax
- Business income is always flagged as business, including older entries
- Insights says when the business has spent more than it made, instead of saying you paid yourself too much. Interest figures on Plan are rounded to the pound

**App 0.7.2, 2 Nov 2026: never reads chats or email**
- Kitty can no longer read chat, text, email or social apps, or marketplaces and app stores, even if they were turned on. Anything it kept from them is deleted when the app opens
- The alert log keeps bank alerts only, so "Copy alerts for Claude" isn't crowded out by chats

**App 0.7.1, 2 Nov 2026: Review fixes**
- A category or "side income" you pick on a Review card is kept when you leave the tab, until the card is added or skipped
- Smart sorting only changes a category when it's reasonably sure and names a real one; a shrug ("Other", low confidence) leaves Kitty's own guess alone. "AI" no longer shows on a card you've set yourself
- A bank telling you you stayed under (or went over) a budget is a summary, not a payment, so it can't be added by mistake

**App 0.7, 1 Nov 2026: smart sorting (opt-in AI)**
- Optional Smart sorting in More: alerts Kitty can't read, and shops it can't place, are sorted by Claude (Anthropic's AI) through Kitty's own small service. Only those alerts are sent, with account numbers, sort codes and emails removed. Off unless you turn it on
- AI answers are marked "AI" in Review and never override your own history; low-confidence answers still show a question mark and stay out of Add all
- The AI service deploys itself from GitHub once the account keys are added

**App 0.6.2, 1 Nov 2026: learns what to ignore**
- Kitty only asks "spent or received?" when an alert talks about money moving; a price in a job post or advert is not a payment
- Job alerts (Airtasker tasks and similar) are skipped; a platform's own payout alerts are skipped because the money is added when it reaches your bank
- After two skips of unclear alerts from the same bank (and none kept), Kitty stops asking about that kind
- An app you turned on that only sends non-payments gets a "Stop reading it?" card

**App 0.6.1, 1 Nov 2026: warnings, not noise**
- Overdraft and low-balance alerts show as a heads-up at the top of Review (with a link to free help for overdrafts), never as payments
- An overdraft charge is offered as a bank charge to add
- Banks' own budget updates and spending reports are skipped; "No amount found" now says "Not a payment"
- Adverts, declines and card-limit notices no longer offer Add
- Only bank, card and wallet apps are suggested for reading (not Vinted or app stores), below your payments
- "Money in" with no payer name no longer copies the last category
- Picking a past date on Log shows how that day went at the top

**App 0.6, 1 Nov 2026: anyone can start; side income without the guesswork**
- Alerts from more UK banks: Lloyds, Halifax, Bank of Scotland, HSBC, first direct, Santander, Nationwide, TSB, RBS, Ulster Bank, Chase, Amex, Virgin Money, Kroo and Curve. Read with general rules until testers send real examples
- Any other app that posts money alerts: Kitty offers to read it ("Money alerts from X"), only if you say yes
- Plan tab: Bills (due now, coming up, paid, mark paid or undo, add and edit, debt payoff dates, subscriptions a year) and Pots (each payday, target, top up, close; new pots can start on the next payday). Pay for something from a pot in Activity. Settings and backups move behind the button on Plan
- First-run setup in the app: how often you're paid, take-home pay, bills, savings and money now if you start part-way; or bring a backup across
- Spending can be marked "Paid from side income": off the daily budget, not a business cost (web app too)
- Insights, when side income is on: this pay month's side income, costs and money paid out; profit this tax year, how much to keep for tax (20%, 26% or 40%), and a warning when more has been paid out than is left after tax

**App 0.5, 1 Nov 2026: nothing hidden, looking back**
- Alerts Kitty can't read but that have an amount go to the top of Review with the bank's own words: Spent, Received or Skip
- Cash withdrawals ask: already gone (add it) or cash to spend (log what you buy)
- Bank notices: tap to see each one in the bank's words; Add anyway where there's an amount, with a warning when it would count a payment twice
- Anything not added can still be added, and shows the bank's wording
- Insights tab: any day in the last 60 days (budget, spent, under or over, what you logged) and a pay month overview (money in, bills, day to day, each day's bar, where it went, compared with the month before)
- Log: one date button for the last 30 days replaces Today/Yesterday
- Food and wine shops count as groceries; vape shops as personal
- Shops nobody has listed: Kitty uses the bank's own category (the symbol Revolut and Monzo put on each alert), then words in the name (Bazaar, Cash & Carry, Cafe, Barbers...)
- Change one entry's category and the other entries from that place change too, so the next one is right
- Log quick picks come from what you log by hand (cash, things the bank doesn't see), favouring often, lately and this time of day; one-offs fade after two weeks; a usual amount is offered when it never changes. Typing still searches everything

**App 0.4, 30 Oct 2026: icons, swipe, one-screen Log**
- Icons are back: categories, money-in types, Activity rows and the tab bar use the same line icons as the web app
- Log fits on one screen: Spent/Received and Today/Yesterday share a row, and the keypad takes whatever height is left, so Save is always in view
- Activity: swipe left to delete (with undo), swipe right to edit
- Edit sheet moves up above the keyboard, so you can see what you're typing
- Alerts: Uber card descriptions tidied; contactless limit warnings and wallet tips skipped

**App 0.3, 29 Oct 2026: fewer double counts (from the first day of real use)**
- A round figure logged by hand (£20) is matched to the bank's exact amount (£20.45). "Same one" keeps your entry and corrects the amount; "Add anyway" if they really are two payments
- A card payment for a bill Kitty already ticked off (YouTube by card, then the Direct Debit day) is skipped instead of counted twice
- A repayment that differs from the usual amount corrects the Direct Debit Kitty ticked off (a few pounds under the usual amount, say)
- Direct Debits that match none of your bills are offered as a One-off bill instead of hidden
- Card reader payouts (Stripe, SumUp, Square, Zettle) count as business takings when side income is on
- Activity: tap an entry to change its name, amount or category; rows show the bank instead of "From bank alert"; deleting a Direct Debit doesn't bring it back
- Review: bank notices grouped into one line; Clear all

**App 0.2 (build 0.1.10), 29 Oct 2026: tap to add**
- Log, Review, Activity and More screens; data saved on the phone; import a backup from the web app
- Review: payments from bank alerts with the category filled in, one tap to add or mark a bill paid, add all, skip; spots ones already logged by hand
- Built-in list of common UK shops for people with no history; Amazon matches Amazon.co.uk
- Every build is screenshotted in CI with made-up data

**v6, 29 Oct 2026: money back (from real-world use)**
- Refunds are spread over the rest of the cycle instead of all landing on one day (a £225 refund made "safe today" jump from £39 to £256)
- New money-in type: Expenses paid back (work reimbursements)
- Spent no longer goes negative; refunds shown under it
- Direct Debits coming up aren't shown as warnings; Activity doesn't repeat the category when there's no shop name; limit labels fit

**App 0.1.x, 29 Oct 2026: alert reader fixes from 37 real alerts**
- Barclays "You've been paid" is money in, not spending
- Money moved between your own banks is paired up and treated as a transfer, even when the alerts arrive minutes apart
- Monzo alerts (everything in the title) are read; Monzo Flex repayments match the debt by name
- Adverts, declined cards and account notices are skipped; card terminal prefixes (SumUp *) removed; Mangopay shows as Vinted

**v4, 27 Oct 2026: money in, Direct Debits, pots, categories**
- Money in has types that do what you'd expect: Pay, Extra, Borrowed, From savings, Refund, Gift, Between my accounts, Business
- Borrowing is spotted by name (e.g. "Monzo Flex" matches the Monzo Flex debt), can be linked to a debt, and raises its balance
- Bills paid by Direct Debit tick themselves off on the due date
- Pots tab: set aside per payday, targets, top-ups, pay from a pot without touching the daily budget
- Custom categories: add with icon and colour, rename, reorder, hide; "More" on Log when there are lots
- Activity rows say Bill, Debt repayment, Subscription or Direct Debit instead of repeating the name
- Money in tile splits pay, borrowed and other

**v3, 27 Oct 2026: for everyone**
- First-run setup replaces the example month (example data is now optional)
- Pay frequencies: monthly on a date, last working day, weekly, fortnightly, 4-weekly
- Currency setting; tax year follows the UK when using pounds, otherwise the calendar year
- Starting mid-cycle asks for money you have now; bills due earlier show as "Paid before you started"
- Side income / self-employed is optional; business features hidden until switched on
- Category limits on setup are sized to what you actually have to spend

**v2, 27 Oct 2026: honest numbers**
- No day-one extrapolation; forecast uses a typical (median) day after enough data
- "Over budget today" shows the new per-day figure from tomorrow
- Real salary replaces the expected figure once logged
- Bills grouped into Due now, Coming up and Paid, with "Mark all paid"
- Debt repayment type with balance and payoff date; business flag on bills
- "Where your pay goes" breakdown; limits that don't fit your budget are flagged

**v1, 27 Oct 2026**: first installable prototype
