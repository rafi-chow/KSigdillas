# Development

KSigdillas is a maintainer-owned event application published as an engineering
case study. This document records the workflow used to evolve the project and
provides a starting point for evaluating or adapting the source.

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The JSON repository works without external services. Use a separate test
Eventbrite event and development database when exercising integrations. Never
include attendee data, credentials, `.env.local`, or production logs in a
commit.

## Change workflow

1. Create a descriptive branch such as `feat/score-history` or
   `fix/eventbrite-mapping`.
2. Make the smallest coherent change.
3. Update documentation when behavior or configuration changes.
4. Run the required checks:

   ```bash
   npm run lint
   npm run build
   ```

5. Explain the motivation, implementation, validation, and risks in the pull
   request.

Use imperative, scoped commit messages such as:

```text
feat: add score history
fix: reject unmatched ticket tiers
docs: clarify local database setup
```

## Review checklist

- Avoid unrelated formatting or generated-file churn.
- Keep credentials and personal attendee information out of the repository.
- Preserve the public-read/admin-write security boundary.
- Validate every new mutation on the server.
- Include accessible labels and keyboard behavior in UI changes.
- Verify visual changes at mobile and desktop widths.
- Keep environment-variable handling backward-compatible where practical.

## Brand and deployment boundaries

The Kappa Sigma emblem is a third-party brand asset and is not covered by the
MIT license. Replace event-specific names, marks, contact details, and external
service identifiers before adapting this project for another organization. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

## Event operations preview (Stripe not required)

`npm run dev:preview` starts an isolated local PostgreSQL cluster and website at
`http://127.0.0.1:3100`. It explicitly overrides the existing database and email
credentials. All orders/receipts in this preview are synthetic; there is no online
payment endpoint that can mark an order paid. Do not expose this preview publicly.

Local preview staff IDs are `organizer`, `scanner`, and `scorer`, with passwords
`local-preview-organizer-only`, `local-preview-scanner-only`, and
`local-preview-scorer-only`. These accounts exist only in the isolated preview
cluster. Production staff must be provisioned with unique secure passwords.

- `npm test`: domain tests and actual temporary PostgreSQL integration tests.
- `npm run test:e2e`: desktop Chromium and mobile WebKit browser journeys.
  Install the test browsers once with `npx playwright install chromium webkit`.
- `npm run typecheck`, `npm run lint`, `npm run build`: code checks.
- `npm run ops -- migrate`: apply versioned operations migrations to the explicitly
  supplied `OPERATIONS_DATABASE_URL` (never implicitly to `.env.local`).
- `npm run ops -- staff`: provision a staff identity using `STAFF_ID`, `STAFF_NAME`,
  `STAFF_ROLE`, and `STAFF_PASSWORD` supplied securely in the process environment.
- `npm run ops -- backup PRIVATE_PATH` / `restore PRIVATE_PATH`: snapshot and
  restore into an empty operations database. Keep backups and the separate
  `TICKET_ENCRYPTION_KEY` private. Never commit them.
- `npm run ops -- check-balances MANIFEST.json` / `import-balances MANIFEST.json`:
  dry-run/review and import explicitly mapped opening balances. Each entry has
  `providerId`, `teamId`, `category` (`tickets`, `giving`, `activities`, `bonuses`),
  `points`, and `reason`. Never import the same points as both an opening balance
  and individual ticket credits. Production Eventbrite cutover is deferred.

Enable the new desk and aggregates with `EVENT_OPERATIONS_ENABLED=true` only in
an isolated preview or after a reviewed production cutover. It requires
`OPERATIONS_DATABASE_URL`; there is deliberately no financial JSON fallback or
implicit use of the legacy `DATABASE_URL`. Migrations are explicit, not run per
web request. Set `TICKET_ENCRYPTION_KEY` to a securely generated 32-byte hex key,
and `APP_URL` to the deployment's HTTPS origin. The key is required to reopen and
resend existing QR links; preserve it through deployments and backups.

Transactional delivery supports `EMAIL_PROVIDER=brevo` with `BREVO_API_KEY` and
verified `EMAIL_FROM` (bare email), or `resend` with `RESEND_API_KEY`. Reply-to is
Zach's public contact. Brevo's free allowance is capped locally at 300 reservations
per rolling 24 hours (Resend: 100), including uncertain attempts. Keep room for
other usage in the same provider account. The ticket page remains available if
email is delayed. A send with an uncertain outcome is held for private staff
review; inspect provider logs before marking acceptance or explicitly retrying.

Configure a one-minute scheduler to POST `/api/jobs` with a Bearer
`MAINTENANCE_JOB_SECRET` of at least 32 random characters. GET is supported for
Vercel Cron; set its `CRON_SECRET` to the same value. The hosting plan must support
the configured cadence and 120-second function ceiling; no paid hosting upgrade
or scheduler is provisioned by this code. A one-shot client is `npm run jobs:run`.
Use a separate monitor for `/api/jobs?health=true` (same authentication); it returns
503 if the last healthy run is older than five minutes. Also monitor nonzero
`attentionRequired` results and failures. A private staff panel shows the heartbeat,
email acceptance/delivery/bounce status, refund reviews, and payment work.

Stripe SDK integration now exists, pinned to API `2026-10-28.endive` with supported
embedded and hosted Checkout. Configure the four price IDs, account ID, matching
test/live keys and webhook secret from `.env.example`. Buyer-paid fees require an
approved permitted fee policy/reference; no automatic switch to organizer-paid
fees exists. Keep `STRIPE_CHECKOUT_ENABLED=false` until service/device acceptance.
Pausing new sales preserves webhook processing and reconciliation for paid buyers.
See `docs/STRIPE_EMAIL_SETUP.md` for exact setup and pending real-service checks.

`npm run ops -- stripe-check` verifies the actual account behind the key, payment/
payout capability, price amounts/currency and current/historical Payment Link IDs without
printing credentials. `check-stripe-import` previews verified approved-link orders;
`import-stripe` explicitly commits them and queues ticket emails. Both require a
reviewed `STRIPE_PAYMENT_LINK_ID`. Refunded/disputed orders are reported for manual
reconciliation before cutover. These commands never load `.env.local` implicitly.
Snapshots now use version 2; version 1 restores fill new collections with empty
arrays. New tables are additive; existing financial/audit history is retained.

For individual legacy tickets, use `check-tickets MANIFEST.json` first, then
`import-tickets MANIFEST.json` only during a reviewed cutover. Each entry contains
`eventId`, `attendeeId`, `name`, `email`, `tier` (`basic`/`meat`), nullable `teamId`,
verified `baseCents`, and nullable ISO `checkedInAt`. Repeating the same import is
idempotent; a changed imported attendee requires explicit reconciliation. Import
refuses to combine individual ticket credits with a team's ticket opening balance.
No actual Eventbrite records have been imported by this implementation task.
See `docs/EVENT_DAY_RUNBOOK.md` and `docs/IMPLEMENTATION_VERIFICATION.md` for daily
operation, evidence, and the still-pending real-service acceptance checks.

## Packet rules transition

The packet and November 1 organizer clarifications govern scoring. Fresh operations
databases seed packet rules. Existing databases require a reviewed transition:
`npm run ops -- check-packet-rules PRIVATE_MANIFEST_PATH`, review the private
manifest and supply its reason, then `npm run ops -- apply-packet-rules PRIVATE_MANIFEST_PATH`.
Run a backup and schema migrations first. The transition refuses a stale snapshot,
preserves immutable ledger history, and reverses listed old score entries/awards
for reviewed re-entry under the packet rules. Existing paid tickets are preserved.
See `docs/PACKET_VERIFICATION.md`; never run against production without completing
the documented reconciliation and release sequence.

Use `npm run dev:preview -- --fresh` for a new temporary synthetic database without
changing the prior persistent preview. The isolated preview/browser harness uses
Next's supported Webpack development mode to avoid repeated Turbopack refreshes;
the production build continues to use the default compiler.

The November 3 organizer Payment Link has separate fee-inclusive price IDs; see
`docs/PAYMENT_LINK_VERIFICATION.md`. Signed paid events can automatically import
the reviewed link with `STRIPE_PAYMENT_LINK_ENABLED=true`; this remains disabled
until actual account/catalog/webhook acceptance. Included fees never add ticket
points or brother ticket revenue. Historical link imports remain supported.
