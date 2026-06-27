# KSigdillas Production Checklist

Complete every item before publishing the Eventbrite event or promoting the
website.

## Event details and approval

- [ ] Confirm real event date
- [ ] Confirm ticket prices
- [ ] Confirm refund policy
- [ ] Confirm final beneficiary
- [ ] Confirm university, chapter, and risk-management approval
- [ ] Confirm address visibility
- [ ] Confirm no-alcohol wording
- [ ] Confirm food and allergy disclaimer
- [ ] Confirm event capacity
- [ ] Confirm door prices

## Eventbrite

- [ ] Confirm Eventbrite order form collects the custom question from each attendee, not just the ticket buyer
- [ ] Confirm final sorority list and exact answer spelling
- [ ] Add final Eventbrite URL to `NEXT_PUBLIC_EVENTBRITE_URL`
- [ ] Keep the Eventbrite event draft/private until all approvals are complete
- [ ] Test the Eventbrite ticket purchase flow with a test or hidden ticket, if possible
- [ ] Test the QR code and wristband check-in flow

## Leaderboard and infrastructure

- [ ] Confirm final leaderboard scoring rules
- [ ] Connect a persistent database before production if JSON storage is temporary
- [ ] Add all required Vercel environment variables
- [ ] Deploy a Vercel preview
- [ ] Test admin leaderboard updates
- [ ] Test Eventbrite sync, including refunds and unmatched answers
- [ ] Confirm public responses contain aggregated scores only

## Final quality assurance

- [ ] Complete final mobile QA on current iPhone and Android sizes
- [ ] Test keyboard navigation and accessible labels
- [ ] Verify ticket, contact, and social links
- [ ] Review all placeholder language
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
