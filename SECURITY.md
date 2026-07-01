# Security Policy

## Supported version

Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

Do not open a public issue for suspected vulnerabilities or exposed
credentials. Use
[GitHub's private vulnerability reporting](https://github.com/rafi-chow/KSigdillas/security/advisories/new)
to contact the maintainer privately.

Include:

- affected route or component
- reproduction steps
- expected impact
- any suggested mitigation

Do not access attendee data that does not belong to you, disrupt the live
deployment, or retain credentials discovered during testing.

## Credential handling

- `.env.local` and `.env*` files are ignored except for `.env.example`.
- Database, Eventbrite, and admin secrets must remain server-only.
- A credential accidentally committed or printed should be rotated immediately;
  deleting it from the latest commit is not sufficient.
- Production values belong in Vercel environment variables, not source files.

## Scope note

The shared admin passcode is intended for a small, trusted event staff. It is
not a substitute for individual accounts, audit logs, or role-based access in a
larger system.
