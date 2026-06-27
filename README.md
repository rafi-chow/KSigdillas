# KSigdillas

A production-ready landing page and live competition leaderboard for Kappa
Sigma Theta-Omega's KSigdillas philanthropy event. Built with Next.js App
Router, TypeScript, and Tailwind CSS.

The Kappa Sigma crest assets in `public/` are the unmodified official files
provided by the [Kappa Sigma logo library](https://www.kappasigma.org/logos-icons/)
and are paired with separate Theta-Omega chapter labeling.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Event content and fallbacks live in `src/lib/eventConfig.ts`. Copy
`.env.example` to `.env.local` to configure the Eventbrite URL, Instagram URL,
contact email, and admin passcode:

```env
NEXT_PUBLIC_EVENTBRITE_URL=https://www.eventbrite.com/e/your-event
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/your-account
NEXT_PUBLIC_CONTACT_EMAIL=contact@example.com
ADMIN_PASSCODE=use-a-long-random-passcode-here
```

`ADMIN_PASSCODE` is server-only. Do not rename it with a `NEXT_PUBLIC_` prefix.
The browser sends the entered passcode to the server once, and successful
access is stored in an HttpOnly, same-site admin session cookie for eight hours.

## Leaderboard

The leaderboard is public at
[http://localhost:3000/leaderboard](http://localhost:3000/leaderboard) and
refreshes every 30 seconds. Public requests use a read-only API endpoint.
The default competition roster is AXO, DZ, ZTA, and DDD, with all categories
reset to zero.

Scorekeepers use
[http://localhost:3000/admin/leaderboard](http://localhost:3000/admin/leaderboard):

1. Enter the value configured as `ADMIN_PASSCODE`.
2. Enter a positive point amount beside a category.
3. Use **+** to add it or **−** to correct a mistake.
4. Use **Edit team** to change a team name/accent, or **Add a team** to create
   a new zero-point team.
5. **Reset demo data** restores the six sample teams after confirmation.

Totals are always recalculated on the server from the five categories. Public
clients cannot call create, update, or reset operations without a valid admin
session.

## Eventbrite Sync Setup

Eventbrite ticket-support sync is optional and disabled by default. When it is
disabled or incompletely configured, the leaderboard continues to work with
manual score updates.

Add these values to `.env.local` for local development and to the server
environment for deployment:

```env
NEXT_PUBLIC_EVENTBRITE_URL=https://www.eventbrite.com/e/ksigdillas-tickets-1992696425651
EVENTBRITE_SYNC_ENABLED=true
EVENTBRITE_EVENT_ID=1992696425651
EVENTBRITE_PRIVATE_TOKEN=your-private-token
EVENTBRITE_TEAM_QUESTION=Which sorority or team are you supporting?
EVENTBRITE_SYNC_MIN_SECONDS=60
```

`EVENTBRITE_PRIVATE_TOKEN` is server-only and must never use a `NEXT_PUBLIC_`
prefix. The application uses it only from the authenticated sync API route.
Public leaderboard responses never include attendee names, emails, order IDs,
or raw Eventbrite data.

For accurate team matching, the answer choices for the Eventbrite question
must match leaderboard display names. The current question is:
`Which sorority or team are you supporting?`

Ticket tiers award support points as configured in
`src/lib/scoringConfig.ts`:

| Eventbrite ticket tier | Ticket points |
| --- | ---: |
| Basicdilla | 1 |
| Chicken + Veggie | 2 |
| Beef Tier | 3 |

To sync, open `/admin/leaderboard`, authenticate with `ADMIN_PASSCODE`, and
select **Sync Eventbrite Tickets**. The result shows the last sync time,
tickets counted, points awarded, skipped attendees, and unmatched answers.
Sync replaces `ticketPoints` with the latest Eventbrite aggregates. Admins can
still manually adjust ticket points between syncs, and Volleyball, Eating,
Donation, and Bonus points remain fully manual and are never overwritten.

Keep the Eventbrite event in draft/private status until the real date, prices,
refund policy, beneficiary, and required approvals are final.

## Demo Walkthrough

The manual leaderboard can be demonstrated without publishing Eventbrite:

1. Run `npm run dev`.
2. Open `/leaderboard` in one browser window.
3. Open `/admin/leaderboard` in another and enter `ADMIN_PASSCODE`.
4. Add points to AXO, DZ, ZTA, or DDD.
5. Refresh the public board, or wait for its 30-second automatic refresh.
6. Use **Reset demo data** to return all four teams and categories to zero.

Testing an actual Eventbrite purchase requires the event to be published so
Eventbrite can issue a ticket. For a controlled test, publish it as a private
event accessible only by its link and avoid publicly promoting that link.
Complete the production checklist before accepting real purchases.

Eventbrite settings can still be edited after publishing, including future
date/time, capacity, ticket availability, and listing content. Changes affecting
existing buyers should be communicated to them. Eventbrite only allows a
published refund policy to become more flexible, not more restrictive, so
confirm that policy before publishing.

### Current storage and future database

The default `JsonLeaderboardRepository` writes local data to
`.data/leaderboard.json` using serialized, atomic writes. Set
`LEADERBOARD_DATA_PATH` to choose another writable path. On Vercel, the mock
automatically uses `/tmp`; this is useful for previews but **is not durable
across function instances or deployments**.

For a live event on Vercel, replace the JSON adapter with Supabase, Vercel
Postgres, or another persistent database:

1. Implement the `LeaderboardRepository` interface in
   `src/lib/leaderboard/repository.ts`.
2. Select that adapter in `src/lib/leaderboard/index.ts`.
3. Keep database credentials in server-only environment variables.

The API routes and both interfaces remain unchanged when the adapter changes.

## Deploying

Import the repository into Vercel, then configure the public, admin, and
Eventbrite variables shown above in Project Settings → Environment Variables.
Use a persistent repository adapter before relying on live scores in
production. The public page needs no authentication; only the admin routes use
`ADMIN_PASSCODE`.

## Quality checks

```bash
npm run lint
npm run build
```

The event landing page is statically rendered. Leaderboard routes use the
Node.js runtime so the repository and secure server-only admin logic can run on
Vercel.
