# Kitty backlog

Snags and improvements, worst first. Add new ones at the top of the right section with the date and where they were seen. Move fixed items to the changelog at the bottom.

Priority: **P1** wrong number or lost data · **P2** confusing or slow · **P3** nice to have

## Snags
| Pri | Found | Snag |
|---|---|---|
| P1 | 29 Oct | App: Bills, Pots, Insights, balance check-ins and Settings screens still only in the web app |
| P1 | 29 Oct | App: first-run setup for new users (only import from the web app so far) |
| P2 | 29 Oct | App: change an entry's date; notes; Business switch; pay from a pot |
| P3 | 29 Oct | App: category icons (dots for now) |
| P2 | 29 Oct | Work expenses: mark a spend as "I'll get this back" so it stays off the daily budget until the reimbursement arrives |
| P2 | 28 Oct | Payments to your own accounts or business (e.g. a business account) show as spending. Let people mark a payee as "one of my accounts" so future ones count as transfers |
| P2 | 27 Oct | Log screen in Received mode is tall on small phones (two rows of types plus the debt picker) |
| P2 | 27 Oct | A pot created mid-cycle takes a full top-up from this cycle. Offer "start from next payday" |
| P3 | 27 Oct | Closed pots disappear completely. Add a "closed pots" list |
| P2 | 27 Oct | "Last working day" pay ignores bank holidays (UK employers usually pay the day before) |
| P2 | 27 Oct | With non-monthly pay, bills track by calendar month. A bill paid early on the 30th counts for the wrong month |
| P2 | 27 Oct | Debt payoff dates ignore interest. Add an optional interest rate |
| P2 | 27 Oct | Turning side income off leaves old business items excluded from the budget with no way to see them |
| P3 | 27 Oct | Date input shows the phone's own format (fine on UK phones, US format elsewhere) |
| P3 | 27 Oct | Debt and business suggestions only recognise UK lender and insurer names |

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

## Changelog
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
