# KSigdillas: finish and production acceptance after the webhook URL change

Updated November 5, 2026. This is the current execution plan. The user reports that the Stripe owner updated the destination URL. **The URL edit is reported complete; actual Stripe-to-Netlify delivery is not yet verified.** This planning/verification pass changes documentation only and leaves production sales and provider settings unchanged.

The complete flow to prove is: guest chooses tickets → Stripe confirms payment → a signed event is durably recorded → one order/ticket set and correct chapter/brother credit are created → the background worker delivers the ticket email → staff admit each ticket once.

## Current evidence

Baseline source: application commit `731858c`, documentation HEAD `0309f1a`; current production deploy `6aeb66c8e611a2697fa2c1ff` at https://ksigdillas.netlify.app. Evidence was collected November 5 at approximately 4:51–4:53 PM Central.

| Check | Observed result |
| --- | --- |
| Netlify production | Current deployment is `ready`; no publication made during this pass. |
| Checkout and staff boundary | Checkout HTTP 200, sales visibly closed, private/no-store; anonymous staff API HTTP 401. |
| Native scheduler | Authenticated health HTTP 200, `healthy: true`, `attentionRequired: 0`; automatic heartbeat `2026-11-05T22:45:05.352Z`. No manual maintenance run was used. |
| Production switches | Website sales, Payment Link import, refund writes, Eventbrite sync and test fixtures false; maintenance true. |
| Production records | Zero orders, tickets, checkout attempts, stored Stripe provider events and ticket-email jobs. One staff account, zero brothers; two existing email-provider callback records. These counts do not prove that no ignored/probe webhook ever reached the endpoint. |
| Stripe catalog / cutover audit | Existing catalog verified read-only. Current active and historical inactive Payment Links each have zero importable paid sessions, zero already imported and zero needing review at audit time. Recheck before launch. |
| Stripe configuration visibility | Endpoint-list and recent-event-list reads both returned HTTP 403 `more_permissions_required`. Existing restricted access does not expose delivery history or subscribed events. Do not expand access just to plan the handoff. |
| Launch checker | Stripe configured; sales unavailable; refund writes false. `launch:check` exits 2, with all nine acceptance checks unset. Presence of a fee-setting variable is not proof that its boolean is approved; the local production configuration reports fee policy approval false. |
| Earlier service acceptance | Real Brevo/Gmail delivery, DNS authentication and final-origin delivery callbacks were verified November 3. Actual purchased-ticket correlation, Outlook receipt and physical-phone rehearsal still need acceptance. |

Private evidence: `.data/deployment/readiness-baseline-2026-11-05.json`, `readiness-stripe-history-2026-11-05.json`, `readiness-launch-gates-2026-11-05.json`. They contain no printed credentials and stay outside Git. Local production-file checks are labeled separately from deployed configuration checks.

### Fresh software checks

The November 5 test run uses isolated PostgreSQL and synthetic/fake payment/email boundaries. It does not charge cards, send ticket emails or create production attendees.

- `npm test`: 97 passed, zero failed/skipped.
- `npm run lint`: passed.
- `npm run test:e2e`: all 34 Chromium/mobile WebKit cases passed, including checkout/policy, staff roles, QR, accessibility, reflow and supply rules.
- `npm run typecheck` and `npm run build -- --webpack`: passed with service credentials cleared and operational writes disabled; this was a local build, not another Netlify publish.
- `npm audit --omit=dev`: zero reported vulnerabilities.

Logs are under `.data/deployment/readiness-*-2026-11-05.log`. These checks establish software behavior, not actual Stripe delivery or physical-device acceptance.

## Execution order and exit criteria

### 1. Prove the changed Stripe destination

Owner/agent read-only verification first; do not recreate products, prices or the existing destination.

- Confirm the existing destination is enabled, live mode, in the intended account, at exactly `https://ksigdillas.netlify.app/api/stripe/webhook`. Record its destination ID, payload/API version and event subscriptions privately. The receiver expects snapshot events containing `event.data.object`; do not switch this integration to thin events.
- Required implemented subscriptions: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `refund.created`, `refund.updated`, `refund.failed`. A wildcard covering them is sufficient. Request only demonstrated missing subscriptions.
- Obtain the owner's Workbench delivery detail for this destination: event ID/type, mode, timestamp, target URL and returned HTTP status. A successful genuine delivery must return 2xx from this receiver with the existing configured signing secret. A GET, an invalid-signature 400, a zero account-wide `pending_webhooks` count or a locally signed request is not delivery proof.
- If there is no recent real event to inspect, use an appropriate existing event or the existing labeled unpaid create-and-expire configuration probe during execution, then correlate its actual Stripe delivery. The probe is ignored by the order processor and creates no tickets; its 2xx proves transport/signature only. Do not invent a paid event in production. Do not create a live charge for testing.
- Verify valid paid-event persistence and duplicate/reordered/retry behavior using the isolated Stripe sandbox in step 3. Live paid fulfillment is observed only for a genuine authorized purchase after opening.
- If the owner created a replacement destination rather than editing the old one, its signing secret needs a private configuration handoff. Do not paste it in chat or replace the current secret on an assumption. Troubleshoot a 400 as mode/secret/payload mismatch; a 503 requires database persistence investigation before proceeding.

**Exit:** exact live destination configuration plus actual signed 2xx delivery evidence. Sandbox durable receipt/retry acceptance follows in step 3. Owner communication is prepared, not sent by the agent.

### 2. Finish the presale worker, monitoring and free-plan budget

A concrete remaining code issue: `src/lib/jobs/maintenance.ts` runs full passes every 15 minutes outside November 15–21. The webhook only records durable receipt; ticket email is delegated to the worker. Checkout return can reconcile an order, but a guest who closes the browser and all ticket-email jobs still depend on the worker. Enabling sales November 5 without adjusting this behavior can leave paid work waiting almost 15 minutes.

- Make due paid-order recovery and ticket-email work progress every minute while presales are active or relevant work remains. Preserve cheap idle work, bounded provider/database deadlines, per-lane progress and current-published-deploy isolation. Align heartbeat and backlog thresholds with the actual operating mode. Do not require an open page or manual job call for recovery.
- Add meaningful clock-controlled checks before November 15, during event week, after sales close with outstanding work, and with sales closed/empty queues. Verify no skipped due work and no repeated completed fulfillment. Preserve the existing no-ambiguous-email-retry behavior.
- Measure the resulting deployed warm/cold idle and busy execution times. Target ordinary paid fulfillment and email-provider acceptance within two minutes under normal operation; report inbox delivery timing separately. Test at least two automatic cycles with application pages closed. Perform intentional failure/retry tests in isolation, not by stopping live recovery.
- Configure an independent free monitor with the authenticated `GET /api/jobs?health=true` endpoint and a private Authorization header. Check both HTTP liveness and JSON `attentionRequired > 0`; healthy HTTP 200 alone is insufficient. Add a public-site availability check. The operator must designate the alert destination before sending a test notification. Prove a safe failure alert and its recovery on a test target/monitor path.
- Reconcile actual Netlify team billing and usage. The existing conservative model is **266.73/300 credits**, only **33.27 remaining**, missing the agreed 90-credit reserve. It includes nine published releases/135 reserved publishing credits. A two-second full-pass assumption projects 301.13. These are forecasts, not actual consumption.
- Recalculate using the remaining November billing window, actual runtime, other sites, traffic and the revised presale cadence; include a final release and recovery allowance. Batch fixes into one final code release where possible. Do not remove already consumed publish costs or use a delayed zero-usage display as evidence. Reuse local/isolated testing for iterations. Resolve the budget gate before launch; no paid upgrade or credit purchase is assumed.

**Exit:** timely browser-independent fulfillment, functioning operator alerts, measured runtime and a defensible budget with the agreed reserve. If Free cannot satisfy this, document the specific deficit and choices before changing hosting or spending.

### 3. Complete real Stripe sandbox → email → ticket → scan acceptance

Use separate sandbox keys, webhook destination, database, encryption key and test-only staff. Match production code, USD catalog amounts and embedded-checkout configuration. Never point sandbox fixtures at production storage. Use the existing test environment if available; missing sandbox access remains a dependency, not a reason to weaken launch checks.

| Case | Independently expected result |
| --- | --- |
| Basic, Meat, mixed, three Meat | Online totals $10.61, $15.76, $26.37, $47.28; base revenue $10, $15, $25, $45; ticket points 100, 150, 250, 450. No extra gross-up. One valid ticket per paid guest. |
| Chapter / optional brother | Correct per-guest chapter allocation and one seller credit; no-team/no-brother works. Unknown attribution cannot prevent a purchase. |
| Decline / 3DS / cancel / return | No valid tickets for unpaid purchases. Authentication and fallback return correctly, without a second unintended payable session. |
| Double click / lost response / closed tab | One logical purchase fulfillment. With all browser pages closed, signed events and scheduled recovery still produce tickets and email. |
| Replay / out-of-order / temporary failure | Repeated event IDs and different events for one payment do not duplicate tickets, scores or logical email jobs. Durable receipt occurs before acknowledgment; transient failure recovers. |
| Refund / dispute in sandbox | Correct ticket validity, revenue/points reversal and review states; owner-operated production refund policy stays intact. Do not enable production refund writes to run these cases. |
| Email | Small agreed test deliveries to Gmail and Outlook: correct guest/tier, all tickets, readable QR/attachment or private link, reply-to, blocked-image fallback, actual inbox receipt. Provider accepted/delivered/bounced states correlate to the specific ticket-email job. |
| Price cutoff | Before/at November 19 at 6 PM Central, presale closes when door price IDs are absent. Cash door prices stay $12/$18. No new sales at/after 9 PM; already-paid work still recovers. Recheck old Payment Link behavior separately. |

Compare Stripe records → durable event → order → tickets → ledger/brother attribution → email job/provider callback → rendered ticket → scan. Keep the event/order/provider IDs in private evidence; screenshots must not expose usable admission tokens.

Stripe directs payment tests to sandbox/test mode and prohibits using real payment details to manufacture live test transactions. This supersedes older plan wording about a required live smoke-test charge. Observe the first genuine buyer-controlled purchase after launch; do not manufacture a purchase/refund to fill a checkbox. Sources checked November 5: [Stripe testing](https://docs.stripe.com/testing), [Stripe webhooks](https://docs.stripe.com/webhooks).

**Exit:** every applicable sandbox case passes against real Stripe, with actual inbox and persisted downstream evidence. Existing mocks remain useful regression coverage but do not replace this stage.

### 4. Complete the organizer and physical-device handoff in one session

One grouped handoff, not repeated individual approval prompts:

- Designate the event/on-call operator and backup. Supply the actual brother roster and individual staff names/roles; provision least-privilege access and rehearse account recovery. An intentionally omitted optional brother roster must be an explicit organizer decision, with the public flow adjusted honestly.
- Review and record current organizer/policy, applicable event permissions, tax treatment, asset rights and retention evidence. The current checkout only accepts documented exempt treatment; if that is not applicable, implement and test the required tax handling before selling. Do not fill acceptance variables with invented approvals.
- Finish the hosting-use review and the actual approved all-in price/fee evidence. Keep $10.61/$15.76 existing prices unless the owner explicitly changes the arrangement.
- On actual iPhone Safari and Android Chrome, run sandbox checkout/3DS, email opening, ticket display, camera scan and denied-camera manual lookup. Include slow cellular, a printed QR, duplicate scans and two simultaneous scanners. Browser WebKit emulation is not a phone-camera test. Include keyboard/screen-reader purchase and recovery checks.
- Rehearse cash door sale, supply collection/caps, social verification, chapter awards, seller correction and private manual-admission fallback using isolated synthetic records.
- Create a fresh private backup; restore into an isolated database, verify encrypted-ticket recovery and retention holds, and record recovery time. Place an operator-controlled recovery copy/key instructions outside this laptop. Rehearse rollback without overwriting newer payment records.

**Exit:** named operators can run admissions/recovery; real-device and organizer evidence exists; all relevant launch-check references can be set truthfully.

### 5. Verify the final candidate and deploy once

After implementation, rerun on Node 22 against the final application revision:

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build -- --webpack
npm audit --omit=dev
```

- Run local/isolated failure and concurrency tests, including the existing 200-order fixture; inspect actual p95 results rather than inventing a production latency guarantee.
- Scan source/history and built public assets for configured private values; inspect deployment secrets/context isolation and reachable dependency advisories. Do not print matched secrets.
- Run `npm run launch:check` with the reviewed production environment. All nine checks must pass, Stripe configuration and price policy must be correct, and browser-fixture overrides must remain false. Evidence strings alone are not acceptance.
- Use the full Netlify build-and-deploy workflow. The earlier standalone/no-build flow once omitted public assets. Preserve the database and encryption key, and take a fresh backup before any production data/configuration mutation.
- Verify HTTPS, all referenced assets, checkout/terms, original artwork, approved steak package and points, authenticated staff roles, Secure/HttpOnly cookies, private cache boundaries, secret absence, signed Stripe delivery and scheduler health on the final deploy. Save sanitized browser evidence.
- Rerun a fresh dry-run audit of both approved Payment Links immediately before activation. Compare to the prior zero-sale snapshot; reconcile any new paid/refunded/disputed or incomplete cases. Controlled import requires reviewed attribution and a backup. Do not silently enable automatic imports.

**Exit:** a specific final commit/deploy has clean automated, provider and operational evidence. No untriaged critical payment/admission/privacy defect or overdue business exception remains.

### 6. Open sales and observe actual orders

Once the above gates pass, execute the authorized launch configuration: website sales enabled, approved fee policy enabled, accepted evidence references present. Keep unrelated import/refund switches at their reviewed values. Verify the public button, correct selectable cart and live Stripe mode without submitting a test charge.

Coordinate the separate lifecycle of the owner's existing Payment Link: decide whether it remains supported during presale and how it is retired at cutoff. Website sales switches do not deactivate that link. Preserve and reconcile already-paid buyers.

Observe the first genuine buyer-controlled order from signed Stripe event through ticket email and staff-visible admission. Confirm exact totals and no duplicate credit. Review scheduler/backlog, email quota and team credits daily through event week; name the responsible operator and response channel. If a failure appears, close new website checkout while preserving webhook ingestion and recovery; separately coordinate any still-active Payment Link with its owner. Roll back application code only when compatible with current durable records.

**Production-ready means:** the final deployed revision passes the applicable matrix, actual provider/device/operator evidence is recorded, budget/alerts/recovery work, and sales activation is verified. Report a precise blocked stage otherwise. A successful build, an edited URL or a green homepage alone is not sufficient.

## External items to gather together

1. Stripe Workbench evidence for the changed destination and a successful signed delivery; sandbox access/configuration through a secure channel if not already available. Do not send secrets in chat.
2. Named operator/backup, approved monitor notification destination, staff and brother roster, and the outstanding organizer evidence.
3. A short rehearsal with an actual iPhone and Android plus designated Gmail/Outlook inboxes.

No need for the Stripe owner's personal login, new live products or broader live credentials merely to complete the URL handoff. The developer can finish code, tests, cost measurement and evidence preparation while these dependencies are collected.
