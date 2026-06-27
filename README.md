# KSigdillas

A production-ready landing page and live competition leaderboard for Kappa
Sigma Theta-Omega's KSigdillas philanthropy event. Built with Next.js App
Router, TypeScript, and Tailwind CSS.

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

Import the repository into Vercel, then configure the four variables shown
above in Project Settings → Environment Variables. Use a persistent repository
adapter before relying on live scores in production. The public page needs no
authentication; only the admin routes use `ADMIN_PASSCODE`.

## Quality checks

```bash
npm run lint
npm run build
```

The event landing page is statically rendered. Leaderboard routes use the
Node.js runtime so the repository and secure server-only admin logic can run on
Vercel.
