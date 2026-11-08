# KSigdillas event-day runbook

**November 8 scoring and donations:** [Current rules and verification](SCORING_AND_DONATIONS_RELEASE_2026-11-08.md) supersedes earlier package-count/revenue winner wording and pooled monetary-donation rounding. Donation checkout: https://donate.stripe.com/7sYaEX4Hidfif4Cg8D2kw02.

**Current hosted checkout:** [November 5 Payment Link integration](NEW_PAYMENT_LINK_2026-11-05.md) records the organizer's $11.58/$17.20 inclusive-tax prices and replaces the earlier online-price and closed-hosted-sales status below. Embedded checkout remains disabled. The Stripe owner must close the independently shared link at the 6 PM presale cutoff.

**November 5 preparation:** [Current release and remaining acceptance](GO_LIVE_PREPARATION_2026-11-05.md) records minute-by-minute due work, five-minute heartbeat checks and read-only monitor access.

**Latest release:** https://ksigdillas.netlify.app offers the approved hosted Stripe Payment Link; embedded checkout remains disabled. See [current payment verification and remaining evidence](NEW_PAYMENT_LINK_2026-11-05.md). Native maintenance runs without a browser; independent monitoring delivered a real incident and automatic recovery to the designated operator inbox.

Scoring instructions below follow the organizer's November 8 clarification; see `PACKET_VERIFICATION.md` for verification. Complete `PRODUCTION_READINESS_PLAN.md`, including organizer acceptance of the confirmed caps and winner measures, before using this runbook for live scorekeeping.

Current release status: event operations, Stripe integration code, brother
tracking and Brevo delivery are deployed. The verified sender, real delivery
callback, native scheduler and independent alert/recovery delivery passed production checks.
Organizer evidence, Stripe cutover/payment acceptance and physical phone
acceptance remain launch gates; see the current handoff above. Do not use local
preview credentials on a public deployment.

## Before opening

- Organizer signs in at `/admin/leaderboard`; check-in staff use `/admin/check-in`.
  Provision individual access; verify the correct role on each phone.
- Verify event clock and prices: Thursday November 19, 2026, 6–9 PM Central;
  volleyball starts at 7 PM. Online totals $11.58/$17.20 include tax and processing and end at 6 PM; ticket base allocations are $10/$15. Cash door prices are $12/$18.
- Confirm production database, backup and separate encryption-key recovery,
  verified email sender, native Netlify maintenance heartbeat, and independent monitoring.
- Test the actual event phones over HTTPS. Camera permission must be granted by
  the phone's user. Test both a fresh QR and a repeated scan.
- Export the organizer-only check-in manifest. Store it privately on one controlled
  device as the connectivity fallback. Keep the staff contact available:
  zachzapalac@gmail.com.
- Enable cash sales in Rules & access only when ready. The server also enforces
  Thursday's 6–9 PM cash-sale window. No quantity cap is configured.

## Admission

Before the event, leave **Rehearsal mode** on. It checks a QR without using the ticket or adding attendance. Event admission is November 19, 6–9 PM Central; an organizer can document an exceptional hours override.

At the door, turn rehearsal off, check whether the person already has a wristband, and enter the wristband/admission ID (for example, W001). Each physical person gets one ID across all scanners. Scan the QR or read an image, verify the Basicdilla/Meat-Veggie tier, and admit only on a successful result. Reusing a wristband ID links an additional ticket to that existing person without increasing attendance. Group bookings admit each separate guest using a separate ID. Never deduplicate people by buyer email or name alone.

Already-used, unpaid, refunded, suspended, or unknown tickets must not receive another admission. If two tickets were mistakenly counted for one person, organizer lookup offers **Link duplicate attendee** with an existing ID and a reason. Correct a mistaken scan with **Correct check-in**. These actions retain audit history and flag finalized attendance awards for review.

If a camera is unavailable, use the QR image reader, paste the ticket link, or
search the guest's name/order reference under Orders. Check-in staff see only the
minimum attendee information. Organizer lookup also supports email. A screenshot
of a payment does not establish payment or a valid ticket.

For a lost email, organizer queues a resend; the guest can also use their order's
confirmation-page ticket links. For a lost/compromised unused QR, organizer replaces
the ticket then resends; its old QR becomes invalid. Correct mistaken scans or team
attribution with a reason. Review any finalized attendance result flagged afterward.

## Door sales

For verified cash, organizer enters the buyer email and each attendee's name,
tier, and optional team, verifies the amount received, then issues tickets. It
creates the order, tickets, points, and email job together. Check in the tickets
once and issue the wristbands. Online presale closes at 6 PM while online door-price IDs are unconfigured.
Cash door admission remains $12/$18. Do not promise online door checkout unless
that separate catalog and cutoff behavior have been configured and verified. The hosted link accepts the owner-configured online payment methods during presale. Record the selected brother for cash sales
when known; a cash sale creates no processing fee.

## Brother contributions

Organizer opens **Brother contributions** for ticket units/base revenue, personal
cash gifts, referred online donations, and donated packages/points. Staff records “Money donated by” or
“Food donated by” independently of the team receiving points. Use the real roster
and approved aliases; unknown or ambiguous referrals remain unassigned.

Seller/donor corrections require a reason. A personal gift is not ticket-sale
revenue, and correcting attribution must not create another receipt or score.
Refunds/disputes reduce active seller credit. Joint donor allocations cannot
exceed the verified amount/packages. Keep the report and CSV private.

## Scoring and winners

- Staff records whole approved packages, the event day, team, and a verification
  reference. Monday cheese/tortillas/veggies/meat/soda/water earn
  75/75/125/175/150/75 respectively; ordinary values are 35/35/50/100/75/50.
  Monday caps per chapter: cheese 10, tortillas 10, soda 6, water 4.
  Refuse excess supplies: zero points and no accepted-package/donor credit.
  Steak: Great Value Steak Fajitas with Fire Roasted Vegetables, 18 oz bag
  ([accepted product](https://www.walmart.com/ip/5195803576)). One complete bag
  earns 175 Monday / 100 Tuesday–Wednesday points, with no chapter cap.
- Slap: $2 / 10 points; pie: $2 / 15. Verify money before recording paid activity
  participation. Hanging: 10 points per attempt; no invented dollar charge.
- Monetary donations are recorded separately from tickets and paid activities.
  Each verified donation earns 50 points per complete $5. Under $5 earns no points; $5 earns 50, $10 earns 100, and $7 earns 50. Separate gifts never pool their remainders. Online gifts import automatically after Stripe confirms payment; do not enter them again as manual receipts. Choose a chapter at checkout for chapter credit. No chapter means funds only.
- Stories earn 25; reels/feed posts earn 50. Verify both required Instagram tags
  and evidence; a post cannot be credited again as another format.
- Monday: use four labeled sorority boxes. Reconcile accepted whole retail packages
  with the records; the most accepted supply points wins 500. Package counts remain a physical reconciliation aid.
- Tuesday: the chapter with the most pie/slap points wins 300. Exclude
  direct donations, ticket sales and fees; deduct reversed/refunded purchases.
- Wednesday overall longest-hang winner receives 300. Each daily contest closes
  at 3 PM that day. There is no Tuesday/Wednesday food award.
- Volleyball and eating each award 400/200/100 for first/second/third, based on
  official results. Attendance is the number of unique people admitted, closes at 9 PM Thursday, and awards 1,000 once.
  Organizer resolves ties and finalizes each contest once. Retain result evidence.
- Never edit historical receipts to hide a mistake. Use an audited reversal or
  result correction and review affected finalized awards.

## Donation receipts and recovery

Use **Brother contributions → Online donations** to inspect payment status, chapter, referral, and the Stripe receipt when available. An unknown chapter/referral stays reviewable; correct it with a reason. A referring brother is not automatically the personal donor. The CSV reports referrals separately from ticket sales and verified personal donations.

Stripe generates payment receipts. The Stripe owner should enable **Settings → Business → Customer emails → Successful payments** for automatic delivery ([Stripe instructions](https://docs.stripe.com/receipts#automatic)). This account-wide setting is not verifiable through the available restricted key; the Dashboard requires the owner's login. Use ordinary payment receipts without a tax-deduction claim. No admission ticket or QR is sent for a donation. Paid invoice/PDF creation is not enabled by this release.

If a signed event is missed, use the private CLI with production environment loaded explicitly: `npm run ops -- check-donations`, then `npm run ops -- import-donations`. The latter reconciles paid donations, including actual refund/dispute state, without issuing tickets or charging anyone. Review unresolved provider events and donation errors; the existing monitor reports business attention. Do not duplicate an online gift as a cash donation.

## Problems and recovery

- Connectivity outage: switch to one controlled manual manifest. Record the exact
  tickets admitted and reconcile when connected. Multiple disconnected scanners
  cannot guarantee global duplicate prevention. Avoid issuing unverified orders.
- Pending payment: retain pending status and investigate provider/order records;
  a return-page visit is insufficient. No duplicate ticket should be created to
  bypass the delay.
- Failed email: inspect the delivery jobs and provider logs. Definite rejections
  can retry; uncertain sends require confirmed acceptance or an explicit retry
  decision in History & recovery. Do not blindly resend an accepted/queued message
  or create another ticket order. The free quota may defer new messages; tickets
  remain available on the order page. Accepted is distinct from delivered/bounced.
- Exceptional cash refund: return the cash first, then record the specific ticket
  refund and reason. Once Stripe is connected, use the exceptional refund form to
  select tickets/fee amount, review, and confirm. Record changes only after Stripe
  confirms. An unallocated dashboard partial refund appears in recovery; search
  its order and allocate the confirmed amount. Refunded tickets lose validity,
  original ticket points and seller credit. Original history remains recorded.
- Database outage: pause sales/scoring, preserve the manual admission record, and
  restore only into an empty recovery database using the private backup and
  matching encryption key. Compare counts/funds/points before resuming writes.
- A failed maintenance job or `attentionRequired > 0` requires organizer review.
  Better Stack Free sends alerts to `chowdhury.rafi01@gmail.com`; the public-site
  monitor runs every five minutes and strict health every three minutes. An actual
  monitor-only incident and automatic recovery reached that inbox on November 5.
  Open the incident, check Netlify function logs and the staff recovery view, and
  resolve the cause. Never mark a payment paid based only on an alert or email.
- Independently check the authenticated health endpoint for a missing healthy
  worker heartbeat. A scheduler that never runs cannot report its own failure.

## Close and retention

Online presale closes at 6 PM while no online door-price IDs are configured;
close event-day cash admission at 9 PM. Reconcile cash and provider records, finalize attendance,
review flagged awards, and export the totals/audit history for the organizer.
Funds raised exclude service fees and taxes and are not a claim of money already
transferred to Movember. Keep private attendee exports only as long as needed for
operation/support. Pause new sales during rollback; preserve paid tickets and
check-in history. Never enable the old and new sales channels without a reviewed
cutover/reconciliation.

## Netlify release, monitoring and rollback

- Use the final HTTPS origin above for organizer and guest entry points. Staff credentials and the encryption recovery key are private; never copy preview credentials into production.
- The native trigger checks due payment/email work every minute, including before and after event week. Empty queues record a lightweight probe heartbeat; housekeeping runs every 15 minutes. Automatic heartbeat freshness is five minutes. The configured external monitor uses `GET /api/jobs?health=true&strict=true` and the separate read-only `MONITORING_HEALTH_SECRET` in the Authorization header. This returns 503 for either stale scheduling or business attention; it never runs maintenance. The write-capable maintenance secret stays private. See [both monitors and acceptance evidence](GO_LIVE_PREPARATION_2026-11-05.md).
- Pending sessions/provider failures retain rapid retry; settled orders use daily fallback polling, entering five-minute checks at admission hours. Unresolved refunds/disputes keep five-minute reconciliation. Signed provider events continue to provide prompt updates.
- Follow [the credit envelope](NETLIFY_CREDIT_BUDGET.md). Netlify billing notifications begin at 50% usage according to its documentation; designate the recipient/operator and verify delivery. Recheck actual balance before opening sales and before event day. Do not purchase a plan or credit pack automatically.
- Before rollback, keep/pause sales and preserve valid tickets, check-ins, provider events and the current database. Restore only an explicitly payment-compatible tested deployment in Netlify; never overwrite live purchases with the zero-order prelaunch snapshot. Retain database URL, encryption key, provider credentials and current callback secret. Inspect queue recovery and private cache behavior after rollback.
- The pre-Netlify snapshot and matching key exist privately on this laptop; Netlify/Neon account access is also needed for recovery. The organizer must retain an approved recovery copy separately before event day. Restore into an isolated empty database first, apply the deletion manifest if present, and reconcile paid tickets/funds before switching any production connection.
- The Vercel project remains unchanged. No Git push or Vercel publish was triggered. Keep its existing payment receiver until Stripe cutover is verified; do not redirect Stripe POSTs through a website redirect. After verification, update old public entry points deliberately. No website-issued production ticket links need migration at this checkpoint (zero orders/tickets); both reviewed Payment Links currently have no paid sales, but re-audit at cutover. Handle the independently shared Payment Link's 6 PM/end-of-event cutoff separately from website flags.
