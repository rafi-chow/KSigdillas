# Steak package approval — November 4, 2026

The organizer supplied [Great Value Steak Fajitas with Fire Roasted Vegetables, 18 oz frozen bag](https://www.walmart.com/ip/5195803576). The retailer page and package image confirmed the product and weight. The accepted-product link uses the canonical Walmart URL without advertising parameters.

Application commit: `2c72b70`. Published [Netlify deploy `6aeb650f127f6358f3266481`](https://app.netlify.com/projects/ksigdillas/deploys/6aeb650f127f6358f3266481).

- One complete bag earns the existing meat rate: 175 Monday / 100 Tuesday–Wednesday points, with no chapter cap.
- Enabled the catalog entry, replaced the pending-package copy, removed the obsolete steak-only staff lock, and show the accepted package in the staff entry form. Unspecified catalog packages still cannot be enabled.
- After publication, backed up production privately and enabled only the saved steak rule using the audited rule service. Revision advanced to 2. All collections other than rules/audit were asserted unchanged inside the transaction; no purchases, score entries or money were created or rescored.
- 97 automated tests passed. The existing 32 browser cases passed; two new Chromium/WebKit staff cases passed in a focused rerun after correcting a test locator. Coverage includes 175/100 daily points, package counts, replay protection, reversal, no invented cash, public product link, keyboard day selection and staff rule controls.
- Typecheck and lint passed. The complete production build, server/maintenance/middleware bundles and publication passed. Live verification confirmed the package text and product link, enabled persisted rule, both daily point values, all referenced assets returning 200, and checkout still closed.

Several upload attempts received Netlify HTTP 500 (`could not upload function: invalid character '<' looking for beginning of value`). Archive integrity checks passed, and both streamed and direct binary requests encountered the same response. The final CLI retry recovered and published successfully; the four earlier canceled deploys were never published. Remote builds were not used because the project has no Git repository attached. No repository connection or Git push was added.

Private evidence is in `.data/deployment/steak-*`; production backup and approval result remain outside Git. Public proof: `docs/images/steak-package-2026-11-04.png`. [The revised credit reserve](NETLIFY_CREDIT_BUDGET.md) includes this eighth published release. Sales and other operational activation gates remain unchanged.
