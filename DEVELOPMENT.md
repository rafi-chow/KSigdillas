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
