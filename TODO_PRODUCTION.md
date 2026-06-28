# KSigdillas Production Handoff Checklist

This list focuses on decisions, approvals, assets, and account access that must
come from other people before KSigdillas can be treated as a real production
event. Put one person's name and a deadline beside every unchecked item.

## Already working

- [x] Production website deployed at `https://ksigdillas.vercel.app`
- [x] Eventbrite ticket page connected to every ticket button
- [x] Eventbrite private token stored server-side in Vercel
- [x] AXO, DZ, ZTA, and DDD configured as leaderboard teams
- [x] Test Basicdilla order for AXO appeared automatically on the leaderboard
- [x] Public leaderboard refreshes Eventbrite ticket totals every 30 seconds
- [x] Public leaderboard responses expose aggregate scores only
- [x] Admin passcode is stored server-side

## Known unresolved website content

These values are still placeholders or provisional and require an answer from
the relevant owner:

- [ ] Replace `Date to be announced` with the approved event date
- [ ] Confirm or replace `Friday · 6:00 PM`
- [ ] Confirm whether `707 S Davis Dr` and `Backyard location` should be public
- [ ] Replace `ksigdillas@example.com` with the monitored contact email
- [ ] Replace the placeholder Instagram URL and `@ksigdillas` handle
- [ ] Add the approved beneficiary name and proceeds statement
- [ ] Confirm the advertised ticket-tier food and prices match Eventbrite
- [ ] Remove or rewrite any tier that will not be sold

## Chapter president, advisor, and university

Get written confirmation from the chapter president/advisor and the university
or fraternity/sorority life office:

- [ ] Approval to hold and publicly promote the event
- [ ] Approval of the final event name, description, date, hours, and location
- [ ] Approval to show `707 S Davis Dr` publicly, or the exact replacement wording
- [ ] Final capacity and any required guest-list restrictions
- [ ] Final alcohol-free policy and exact wording
- [ ] Risk-management plan, emergency contact, and incident-reporting process
- [ ] Security, insurance, waiver, or university police requirements
- [ ] Weather, postponement, and cancellation decision-maker
- [ ] Permission to use Kappa Sigma, Theta-Omega, and university branding
- [ ] Name and phone number of the person authorized to give final launch approval

## Treasurer and money handling

Get these decisions from the chapter treasurer or financially responsible
officer. Do not use a personal bank account unless the chapter explicitly
authorizes it.

- [ ] Legal name of the organization receiving Eventbrite payouts
- [ ] Eventbrite payout bank account and authorized account holder
- [ ] Required tax/business information entered directly into Eventbrite
- [ ] Final price and quantity for every ticket tier
- [ ] Ticket sales start/end times and door-sales policy
- [ ] Whether Eventbrite fees are absorbed or passed to buyers
- [ ] Final refund policy approved before wider promotion
- [ ] Process and authorized person for refunds, disputes, and chargebacks
- [ ] Cash/card procedure for any walk-up sales
- [ ] Event budget, spending authority, and post-event reconciliation owner
- [ ] Written plan for transferring proceeds to the beneficiary

Never place bank details, tax IDs, passwords, or API tokens in this repository.

## Philanthropy chair and beneficiary

Get confirmation from the philanthropy chair and an authorized beneficiary
representative:

- [ ] Beneficiary's exact legal and public-facing name
- [ ] Beneficiary contact person and written permission to name them publicly
- [ ] Approved beneficiary logo and permission to use it
- [ ] Exact proceeds statement: percentage, net proceeds, fixed amount, or other
- [ ] Any required disclaimer about tax deductibility
- [ ] Donation destination, payment method, deadline, and receipt process
- [ ] Approved short description of the beneficiary and the event's impact
- [ ] Approval of all beneficiary wording on Eventbrite and the website

Do not publish a percentage or “all proceeds” claim until the treasurer and
beneficiary have approved the exact calculation.

## Event chair and venue/property owner

- [ ] Final date, start time, end time, setup time, and cleanup deadline
- [ ] Venue/property-owner permission
- [ ] Exact guest entrance and check-in location
- [ ] Parking, rideshare, and accessibility instructions
- [ ] Restroom, lighting, power, internet, trash, and seating plan
- [ ] Maximum safe occupancy
- [ ] Rain/heat/severe-weather backup plan
- [ ] Neighbor/noise plan and required permits
- [ ] Accessibility accommodations and contact person
- [ ] Final event-day schedule and list of responsible leads

## Food lead and safety

- [ ] Final menu for Basicdilla, Chicken + Veggie, and Beef tiers
- [ ] Confirm whether every advertised tier will actually be sold
- [ ] Ingredient list and allergen/cross-contamination statement
- [ ] Vegetarian and other dietary accommodation plan
- [ ] Food quantities, serving limits, and “while supplies last” wording
- [ ] Required food-handler training, health permit, or vendor documentation
- [ ] Cooking, hot-holding, cold-storage, handwashing, and cleanup plan
- [ ] Person responsible for food-safety decisions during the event

## Competition and sorority representatives

Get one primary contact from AXO, DZ, ZTA, and DDD:

- [ ] Confirm each sorority is participating
- [ ] Confirm official display name, abbreviation, and preferred accent color
- [ ] Confirm permission before using any sorority crest or logo
- [ ] Confirm Eventbrite answer choices exactly: `AXO`, `DZ`, `ZTA`, `DDD`
- [ ] Decide whether one multi-ticket order must answer once per attendee
- [ ] Final points for each ticket tier
- [ ] Final volleyball, eating competition, donation, and bonus-point rules
- [ ] Competition eligibility, roster size, substitutions, and safety rules
- [ ] Tie-breaking, penalties, corrections, and dispute process
- [ ] Ticket-point cutoff time and final leaderboard lock time
- [ ] Named scorekeeper and backup scorekeeper
- [ ] Named person authorized to correct or reset scores

## Eventbrite owner

The Eventbrite account owner should complete or approve:

- [ ] Final title, date/time, timezone, address, description, and organizer profile
- [ ] Final ticket names, prices, quantities, fees, and sale windows
- [ ] Final refund policy and contact information
- [ ] Order form asks the support question for each attendee when appropriate
- [ ] Confirmation email includes parking, check-in, food, and policy instructions
- [ ] Kappa Sigma profile image and event artwork are approved and correctly cropped
- [ ] Required payout and tax setup is complete
- [ ] Necessary staff receive Eventbrite roles; do not share the owner password
- [ ] Test each real ticket tier from order through confirmation
- [ ] Test cancellation/refund removal from leaderboard totals
- [ ] Review unmatched Eventbrite answers in the admin page
- [ ] Decide when to remove the free test tier and test order

## Door and QR check-in team

- [ ] Assign a check-in lead and enough door volunteers
- [ ] Install **Eventbrite Organizer** on each scanning phone
- [ ] Give scanners check-in-only Eventbrite roles where possible
- [ ] Test the existing ticket QR code using a second screen
- [ ] Confirm duplicate QR codes show an already-used warning
- [ ] Test manual name lookup and check-in
- [ ] Test check-out/re-entry policy
- [ ] Decide what wristband each ticket tier receives
- [ ] Purchase and count wristbands; define lost/replacement policy
- [ ] Prepare charged backup devices, chargers, and a hotspot
- [ ] Export/print a backup attendee list shortly before doors open
- [ ] Define the walk-up, invalid-ticket, refund, and accessibility procedures

Scanning checks a guest into Eventbrite. Leaderboard ticket points are awarded
when a valid attendee ticket is registered, not when its QR code is scanned.

## Marketing and communications

- [ ] Final Instagram account and contact email
- [ ] Final poster/social artwork and approved sponsor/organization logos
- [ ] Approved short and long event descriptions
- [ ] Promotion start date and posting schedule
- [ ] Sorority/chapter contacts responsible for sharing the event
- [ ] Buyer communication owner for date, venue, policy, or refund changes
- [ ] Photographer/media-release policy
- [ ] Optional custom domain and access to its DNS account

## Technical production ownership

Someone must own the website after the original developer is unavailable:

- [ ] Name a technical owner and backup
- [ ] Add the technical owner to the private GitHub repository
- [ ] Add the technical owner to the Vercel project with least-required access
- [ ] Transfer production accounts to chapter-controlled email addresses
- [ ] Choose and configure Supabase/Postgres or another persistent database
- [ ] Move manual volleyball/eating/donation/bonus scores off Vercel `/tmp`
- [ ] Test database backups and score export/recovery
- [ ] Decide who receives production error/uptime alerts
- [ ] Record how Eventbrite and Vercel tokens will be rotated
- [ ] Share the admin passcode only with scorekeepers and rotate it after the event
- [ ] Define attendee-data retention and deletion expectations
- [ ] Remove test credentials, test orders, and unused staff access before launch

The current Eventbrite ticket totals are live and durable because Eventbrite is
their source of truth. Manual competition categories still use temporary JSON
storage on Vercel and are **not production-safe** until a database is connected.

## Final acceptance test

Complete this with the event chair, treasurer, scorekeeper, and door lead:

- [ ] Buy one ticket from each enabled tier
- [ ] Confirm every confirmation email and QR code
- [ ] Confirm each sorority answer awards the intended points
- [ ] Confirm a refund/cancellation removes the ticket points
- [ ] Scan, duplicate-scan, manually check in, and check out test tickets
- [ ] Add and subtract every manual score category
- [ ] Confirm scores survive a redeploy and a fresh browser/device
- [ ] Test homepage, leaderboard, Eventbrite, contact, and social links
- [ ] Test current iPhone, Android, desktop, and poor-network behavior
- [ ] Test keyboard navigation, text contrast, and accessible labels
- [ ] Review all dates, prices, addresses, names, policies, and placeholder copy
- [ ] Run `npm run lint`
- [ ] Run `npm run build`
- [ ] Export a final attendee/check-in backup

## Launch sign-off

- [ ] Chapter president/advisor approved
- [ ] University/risk management approved
- [ ] Treasurer and payout setup approved
- [ ] Beneficiary wording approved
- [ ] Venue and food plans approved
- [ ] Event chair approved
- [ ] Technical owner approved production readiness
- [ ] One person is named to make the final publish/promote decision
