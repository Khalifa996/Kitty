# Kitty backlog

Snags and improvements, worst first. Add new ones at the top of the right section with the date and where they were seen. Move fixed items to the changelog at the bottom.

Priority: **P1** wrong number or lost data · **P2** confusing or slow · **P3** nice to have

## Snags
| Pri | Found | Snag |
|---|---|---|
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
| P1 | Custom categories |
| P2 | Bill frequencies other than monthly |
| P2 | Multiple income sources |
| P2 | Backup to a file; restore from a file |
| P2 | Split one payment across categories |
| P2 | "Spend less on X" nudges based on the cycle so far, without nagging |
| P3 | Search Activity by date range and amount |
| P3 | Haptics and sound settings |
| P3 | Light theme |

## Changelog
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
