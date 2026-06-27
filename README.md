# KSigdillas

A production-ready landing page for Kappa Sigma Theta-Omega's KSigdillas
philanthropy event. Built with Next.js App Router, TypeScript, and Tailwind CSS.

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
and contact email:

```env
NEXT_PUBLIC_EVENTBRITE_URL=https://www.eventbrite.com/e/your-event
NEXT_PUBLIC_INSTAGRAM_URL=https://instagram.com/your-account
NEXT_PUBLIC_CONTACT_EMAIL=contact@example.com
```

## Quality checks

```bash
npm run lint
npm run build
```

The app is statically rendered and can be deployed directly to Vercel.
