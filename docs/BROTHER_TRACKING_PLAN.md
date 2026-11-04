# Brother contributions and ticket attribution

November 1 planning update: the packet is authoritative. Supply fixture expectations below are implemented and locally tested; see `PACKET_VERIFICATION.md` for the current run. Follow `PRODUCTION_READINESS_PLAN.md` for cap/refusal/reversal effects: report accepted physical packages and their points; refused excess creates neither donor contribution nor chapter credit.

October 29, 2026. Subsequently authorized with “implement”: this feature is now implemented and locally tested. See `STRIPE_BROTHER_VERIFICATION.md` for current evidence and the real roster/service setup still required. The specification below remains the design reference. The buyer pays the intended permitted processing charge; the organizer does not absorb it by default.

## What staff will see

Add a private organizer report with one row per brother and separate columns:

| Metric | Meaning |
| --- | --- |
| Tickets sold | Paid, valid ticket units attributed to that brother through “Which brother sold you your ticket?”; a three-ticket order counts as three tickets, not one sale. |
| Ticket revenue | Attributed ticket base amounts after allocated refunds/disputes, excluding buyer service fees and tax. |
| Personally donated | Verified monetary donations by that brother, minus reversals/refunds; not money from people who bought tickets from him. |
| Donated items | Verified retail package quantities grouped by category/day, with the approved donation points displayed separately. Do not invent a dollar value for food. |
| Needs review | Unmatched referrals, uncertain donor identity, incomplete receipt verification, or unallocated partial refunds. |

Allow sorting by tickets sold, revenue, or money donated; no combined competitive score or new public brother leaderboard is required. Show active totals plus a drill-down of original sales, refunds, disputes, gifts, and corrections. Export the same filtered data as CSV. Preserve the existing public sorority/team leaderboard; brother attribution creates no additional team points or event revenue.

## Attribution rules

- Maintain a roster with immutable brother IDs, display names, active status, and organizer-approved aliases. A display-name edit must not split historical totals. Archiving removes a brother from new selections while preserving history.
- On the website use a searchable roster selector with “No brother / don't know.” Retain the familiar field label. Selecting a brother applies to all tickets in that order; split seller credit is not introduced unless requested later.
- Until a roster is supplied, preserve existing free-text referrals as unresolved records; never invent brother identities. The roster and approved aliases are the only additional tracking data needed from the organizer.
- Import the supplied Payment Link's actual `soldby` custom-field value using its verified stable field key. Keep the original text. Normalize whitespace/case for exact alias matching; ambiguous nicknames, duplicate names, and fuzzy matches go to review rather than being silently assigned. Missing fields stay unassigned and do not block valid ticket issuance.
- Attribution is buyer-reported, not proof of who persuaded the buyer. Record its source (website selection, original Stripe custom field, or staff correction) and keep an audit trail.
- Persist the selected brother ID with the order snapshot and provider reference. Stripe metadata is a correlation aid; payment verification and our validated order remain authoritative. For legacy standalone Payment Links, validate the paid session before importing its referral.
- Count only verified paid tickets, including staff-verified cash door sales where a seller was recorded. Pending, declined, abandoned, expired, test, refunded, and open/lost-dispute tickets are excluded from active sales totals. A won dispute restores eligible credit exactly once.
- A resend, replacement QR, check-in, attendee rename, or team change does not create another sale or silently change the seller. Buyer self-purchases are not donations; if the buyer explicitly chose himself as seller, retain that reported attribution without guessing identity from names/emails.
- An organizer may correct the seller for an order with a required reason and revision check. Transfer all eligible ticket credits atomically between brothers while leaving tickets, money, and sorority points unchanged. Corrections must survive webhook replay and re-import.

## Recording personal donations

- Add a separate “Donated by” brother field to staff money-receipt and food-package entry flows. The team benefiting from a contribution is independent of the donor; support no team without losing donor attribution.
- Staff records the actual giver, verified amount or accepted package quantity, date, source reference, and verification status. A pledge, screenshot alone, or the brother who collected someone else's money is not a verified personal donation.
- Reuse the existing monetary receipt or food entry as the source record. Brother reports are projections of those records, not a second receipt or second score ledger. Food identity/day/package and disabled steak rules still apply.
- Keep this phase focused on attributing existing donation channels. It does not add a public Stripe donation checkout or assume ticket purchases are charitable gifts.
- Default to one donor per entry. For a jointly funded gift, staff records explicit allocations with a shared source reference; enforce that allocated cents/packages never exceed the verified source total. No full credit to two brothers for the same gift.
- Donation reversal/correction updates the donor view and any existing team score through the original audited correction flow. Changing donor identity alone must not change cash or team points. Backfilled donations without known donors remain unattributed, not guessed.

## Data and access changes

- Add durable roster/alias records and attribution records linked to orders, monetary receipts, or food entries, plus original referral text and resolution status. Unique source constraints prevent double attribution; append correction history rather than erasing the original.
- Add normalized seller/donor fields to validation, staff forms, order fingerprints, provider mapping, imports, exports, and audit views. A different seller on a retried request is a changed payload, not silent mutation of an existing order.
- Organizer: full reports, corrections, roster and export. Scorer: select a donor while recording a permitted receipt/food entry, without unrestricted access to buyer details or personal donation totals. Check-in role: admission functions only. Public APIs: no donor records, buyer data, or brother totals.
- Brother selection exposes only approved roster display names and opaque identifiers, not contact details. Referrals and CSV exports must be escaped; protect against spreadsheet formulas in user-supplied text. No extra brother login system is needed for this phase.
- Backfill existing paid orders and donations with a dry-run report, preserving unresolved values. Import is idempotent; review corrections must not be overwritten by the next sync.

## Exact acceptance fixtures

Use invented Brother A and Brother B in isolated test storage; these are not real roster entries.

1. One paid order: two Basic tickets and one Meat ticket attributed to A. A has **3 tickets / $35 ticket revenue**, **$0 personally donated**. Any buyer fee/tax is excluded. If all three support AXO, AXO has **350 ticket points**.
2. A separately gives verified $7 and $3 to AXO. A has **$10 personally donated**; A's ticket metrics remain **3 / $35**. AXO gains **100 donation points**, not another $10 of ticket revenue. Reverse the $3: personal donations **$7**, team donation points **50**.
3. A donates two cheese packages on Monday and one water package Tuesday, within available caps. Show **cheese 2, water 1, donation points 200** (2 × 75 + 50), with no invented cash value. Cash donations stay $7 and ticket metrics stay 3 / $35. Test that refused excess creates no donor package/point credit and that accepted-package reversals restore cap allowance exactly once.
4. Refund one Basic ticket from fixture 1: A has **2 active tickets / $25 ticket revenue**, AXO **250 ticket points**. Keep original-sale and refund history. A's gifts are unchanged.
5. Correct that order's seller to B: A has **0 / $0**, B **2 / $25**; A still has the same personal gifts. Event money and AXO totals do not change. Re-import/replay must retain the correction.
6. Blank referral yields unassigned sales. An approved alias differing only in case/whitespace resolves; ambiguous “Alex” remains unresolved. Resolving it later credits the correct brother once, with no new payment or team points.
7. One $20 donation split A $12 / B $8 totals $20. Reject A $12 / B $12 against that same $20 source. Reject duplicate reference import and fabricated unverified donations.
8. Race two identical webhook/import requests and two conflicting organizer corrections. One financial effect is committed; one correction wins and the other receives a conflict. Repeated scans/resends never change sales.

The full release test sequence, service checks, and evidence requirements are in `LAUNCH_TEST_PLAN.md`. No new brother-tracking case may be marked passed using the earlier 31-test result; implementation and fresh evidence are required.
