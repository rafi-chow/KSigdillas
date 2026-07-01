# Contributing

Thanks for improving KSigdillas.

## Before starting

- Open an issue before a large feature or architectural change.
- Keep pull requests focused on one concern.
- Never include attendee data, credentials, `.env.local`, or production logs.
- Preserve the public-read/admin-write security boundary.

## Local setup

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The JSON repository works without external services. Use your own test
Eventbrite event and development database when exercising integrations.

## Development workflow

1. Create a descriptive branch such as `feat/score-history` or
   `fix/eventbrite-mapping`.
2. Make the smallest coherent change.
3. Update documentation when behavior or configuration changes.
4. Run the required checks:

   ```bash
   npm run lint
   npm run build
   ```

5. Explain the motivation, implementation, testing, and risks in the pull
   request.

Use imperative, scoped commit messages such as:

```text
feat: add score history
fix: reject unmatched ticket tiers
docs: clarify local database setup
```

## Pull-request expectations

- No unrelated formatting or generated-file churn
- No secrets or personal attendee information
- Server-side validation for every new mutation
- Accessible labels and keyboard behavior for UI changes
- Responsive verification for visual changes
- Backward-compatible environment-variable handling where practical

All contributions must follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
