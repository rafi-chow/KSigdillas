# Current Stripe Payment Link — November 5, 2026

The organizer supplied https://buy.stripe.com/6oU4gz7Tugru8GeaOj2kw03 and requested website integration. This supersedes the old public link and the earlier $0-tax assumption for hosted purchases. It does not certify the organizer's registration, venue permissions or tax filings.

## Reviewed Stripe configuration

- Active live link `plink_1UYaoDFjxvBryqqLR9EFY0y7` in the existing connected catalog/account.
- Basic: `price_1UYanjFjxvBryqqL1vfly4Ma`, $11.58. Meat/Veggie: `price_1UYankFjxvBryqqL2sdHaW0V`, $17.20. Both prices use inclusive tax; Stripe automatic tax was already enabled by the owner. No rate or registration was changed by this task.
- Basic defaults to one; Meat/Veggie appears under "Add to your order." For only Meat/Veggie, add it and set Basic to zero. Both quantities can reach 99; the importer supports those actual limits.
- Chapter dropdown keys match AXO/DDD/DZ/ZTA/none. Optional `soldby` text supports brother attribution; unknown names remain reviewable. Stripe collects the buyer's name, not individual guest names.
- Card, Link and Cash App methods remain owner-configured. Unpaid/abandoned or delayed-payment sessions issue no tickets. Async success is required before issuing a ticket for a delayed payment.
- Hosted confirmation tells the guest to retain their Stripe receipt. Our signed-event importer queues one QR per paid pass to the purchase email; additional guest names remain pending for organizer correction.

## Website and fulfillment

The website ticket buttons lead through `/checkout` to the supplied link. The page displays the reviewed totals, explains the Meat/Veggie cart controls and links terms/privacy. Public online prices match Stripe. The separate embedded checkout remains disabled; its launch evidence is not fabricated or bypassed by claiming tax exemption.

Production link imports use the reviewed link ID and both exact price IDs. Signature verification and durable event receipt remain at `https://ksigdillas.netlify.app/api/stripe/webhook`; a new Payment Link in the same account does not need a separate webhook destination. Account/secret/mode checks, price/quantity validation and idempotency remain enforced.

The importer uses Stripe's completed inclusive-tax calculation and verifies its line-item sum. Accounting preserves base ticket allocations of $10/$15, records actual included tax separately, and records the remainder separately from tax. Tax and fees do not increase chapter fundraising totals or ticket points. Full confirmed refunds reverse base, fee and tax independently; external partial refunds require an organizer allocation. Refund writes remain disabled, and tax-inclusive refunds are owner-operated in Stripe.

Previously unmatched, signature-verified payment-intent/charge references are retried after the checkout association is established. This handles event reordering without discarding unrelated or financial reviews. Automatic scheduling and the existing read-only external health monitor remain in place.

## Verification and remaining evidence

- Stripe API and public checkout verified the link, exact USD amounts, inclusive-tax settings, chapter/referral fields and Meat/Veggie option.
- A new unshared tax-enabled live configuration session totaled $28.78, then was immediately expired unpaid. No charge or ticket was created. This proves create/expire compatibility, not a completed purchase or tax-location determination.
- Isolated tests cover duplicate and reordered events, async payment, abandoned checkout, inclusive tax validation, chapter funds, QR attachments, maximum quantities and tax-inclusive full refunds.
- Release, test totals and production evidence are finalized after publication. Private artifacts remain under `.data/deployment/new-link-*` and `new-payment-link-*`.
- Actual Stripe-to-Netlify signed delivery and the purchased-ticket inbox correlation still require observed delivery or a genuine buyer-controlled purchase. No artificial paid event, test charge or refund is used to claim that result.

Website entry closes at Thursday's 6 PM Central presale cutoff. The independently shared Stripe link must also be closed by the account owner at that cutoff; website flags do not deactivate Stripe's hosted page. Keep individual check-in accounts and a private recovery copy as described in the event-day runbook.

After any tax-inclusive purchase, the older `6f4abf1` release cannot reconcile these new amounts. Preserve live orders and deploy a compatible forward fix if needed; do not restore a zero-order snapshot or roll payment processing back to that older catalog.
