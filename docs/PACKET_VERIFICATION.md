# Packet rules implementation and verification

**Superseded scoring definitions (November 8):** [Scoring and donation release](SCORING_AND_DONATIONS_RELEASE_2026-11-08.md) records Monday supply points, Tuesday pie/slap points, Wednesday longest hang, Thursday unique attendees, and per-donation $5 point units. Earlier package-count, pie/slap-revenue, and pooled-donation descriptions below are historical.


**November 4 package approval:** the organizer supplied [Great Value Steak Fajitas with Fire Roasted Vegetables, 18 oz](https://www.walmart.com/ip/5195803576). The complete bag is now an accepted steak package at the existing 175 Monday / 100 ordinary points, with no cap. Historical references to pending steak details below are superseded by this approval.

November 1, 2026. Implemented locally on `feat/event-operations`. The packet and subsequent organizer clarifications are authoritative. This section records the local rules verification run. Subsequent approved database preparation and November 3 Vercel configuration are recorded in `DEPLOYMENT_SETUP_STATUS.md`; November 3 payment changes passed 71 tests in `PAYMENT_LINK_VERIFICATION.md`. No new code deployment, real payment, external email or historical import occurred.

## Implemented

- Explicit Monday supply rates: cheese/tortillas/veggies/meat/soda/water **75/75/125/175/150/75**; ordinary **35/35/50/100/75/50**. Chicken and the approved 18 oz steak package both use the meat rate.
- Monday per-chapter caps: cheese 10, tortillas 10, soda 6, water 4. Over-limit submissions are rejected in the database transaction with the remaining allowance. Staff accepts only the permitted amount and refuses the rest. Refused supplies create no accepted package, donor contribution or points. Reversals restore allowance once; rejected supplies are never automatically promoted.
- Four Monday chapter boxes, with **500** to the most accepted whole retail packages. Box counts must be physically reconciled before finalization. Package count is independent of point value.
- Tuesday **300** to the most verified pie/slap money, net of reversals. Activity receipts are joined to their dated, attributed source entries. Direct gifts, tickets, other days, no-team receipts and fees do not contribute to chapter eligibility.
- Story **25**, reel/feed **50**, both required Instagram tags verified by staff. Canonical post references prevent a reel/feed URL from receiving duplicate credit. Social reversals retain history.
- Volleyball and eating **400/200/100**, distinct eating score totals, official result evidence, unique chapter placements and audited correction. Tuesday/Wednesday food-winner awards and fourth-place volleyball award are retired.
- Optional named timed hanging entries support the one overall longest-hang winner, **300**, with **10** per attempt. Written official result evidence supports off-site timing. Daily awards enforce their cutoff, and affected entry changes flag finalized results for review.
- Private chapter representative/Queso Queen contact records under organizer access. Public content, supply guide and staff forms explain the revised rules.

## Independent expected values

| Fixture | Expected result |
| --- | --- |
| One package of each active supply category, including steak | **850 Monday / 445 ordinary**, $0 invented cash |
| Two Monday cheese bags plus Tuesday water pack | **200 points** |
| Two cheese + soda + water | **375 Monday / 195 ordinary** |
| Nine cheese accepted, then three offered | Reject the three-package submission; one remaining slot; totals stay **9 / 675** until staff accepts one |
| Staff then accepts one, refuses two | **10 packages / 750 points**; no credit for refused supplies |
| Reverse original nine after the 9+1 sequence | **1 / 75**, nine slots restored; point delta **-675**, no repeated effect |
| Six simultaneous submissions for the final cheese slot | Exactly **one** accepted; independent SQL confirms **10 packages / 750 points** |
| Monday A: four cheese; B: three chicken | A **4 packages / 300 points**, B **3 / 525**; A wins **500** |
| Tuesday A: two pies + one slap; B: four slaps | Both **40 activity points**, A **$6**, B **$8**; B wins **300** |
| Add direct gift $100 to A; reverse two of B's slaps | Direct gift excluded; A **$6**, B **$4**; finalized result needs reviewed correction |
| Story + reel + distinct feed post | **125**; same reel credited as feed adds zero |
| Volleyball or eating placements | **700** across first/second/third; first **400** |
| Retire old 300-point volleyball winner; finalize packet winner | Old ledger retained; one **-300** retirement, one new **400**, no double reversal |

## Executed checks

Final counts and command outcomes for the release-candidate run are below. Tests use Node 22, synthetic people/receipts/payments, isolated PostgreSQL 18, Chromium and iPhone-sized WebKit. Browser emulation does not prove physical-phone readiness.

- Domain/provider/endpoint/real PostgreSQL suite: **67 passed, 0 failed, 0 skipped**.
- Desktop/mobile browser journeys: **20 passed**, Chromium and iPhone-sized WebKit.
- TypeScript, lint and final production build: **PASS**; build used Next 16.4.3 with all external database/payment/email connections explicitly disabled.

The browser harness uses Next’s supported Webpack development mode after a Turbopack Fast Refresh loop interrupted screenshot capture. The final complete 20-case run passed with no retries; the separate production build used the default Turbopack compiler. Public-home and synthetic staff screenshots were visually inspected.

Logs: `/tmp/ksigdillas-packet-tests.log`, `/tmp/ksigdillas-packet-browser.log`, `/tmp/ksigdillas-packet-build.log`. Browser screenshots are ignored artifacts under `test-results/`; synthetic private contact examples must not be confused with the real roster.

## Existing database transition

Schema migration 003 records the additive version; fresh databases seed packet version 1. Existing databases are not silently reseeded. Old-policy scoring/award entry is closed until the explicit packet transition is applied; paid-order recovery, existing tickets and financial history remain available.

1. Back up using `npm run ops -- backup PRIVATE_PATH` and retain the separate ticket encryption key.
2. Apply schema migrations with `npm run ops -- migrate` against the explicitly selected environment.
3. Run `npm run ops -- check-packet-rules PRIVATE_MANIFEST_PATH`. The file is created privately without overwriting an existing file. Review the rule diff and listed old entries/awards, retain their source evidence, and fill the manifest's reason.
4. `npm run ops -- apply-packet-rules PRIVATE_MANIFEST_PATH` verifies the exact snapshot inside the transaction, requires every affected record, appends reviewed reversals/retirements, and installs the new rules. Changed snapshots require a fresh dry run. Replaying the same applied manifest does nothing.
5. Re-enter accepted old supplies/social entries under the confirmed packet policy and re-finalize official results where applicable. Reconcile quantities, money and standings before reopening scorekeeping. Historical ledger entries and paid tickets are preserved; the migration does not guess whether an old over-cap package was actually accepted.

Both migration commands are intended for authorized operators using secure process configuration. They never implicitly load `.env.local` or the legacy `DATABASE_URL`.

## Production gates remain open

Actual Stripe account/fee setup and sandbox acceptance, verified email sender and actual inbox delivery, a deployed scheduler and independent monitor, real brother/staff roster, legacy sales reconciliation, actual iPhone/Android rehearsal, reviewed production transition and controlled live smoke purchase remain required. See `STRIPE_EMAIL_SETUP.md` and `PRODUCTION_READINESS_PLAN.md`. Local test success does not close these external gates.

Local configuration check: Stripe secret/publishable/webhook keys, Brevo key/sender
and maintenance-job secret remain absent from `.env.local`. No connected Stripe,
Brevo or Vercel setup tool was available in this session. Provider configuration
elsewhere has not been verified.
