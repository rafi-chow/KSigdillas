# Donation rate correction — November 8, 2026

The organizer clarified the rule: **10 points per dollar on donations of $5 or more.** The homepage, supply guide and staff desks now use that wording. The hero retains Buy tickets, See the week’s events and its smaller Donate link.

Each gift is evaluated separately. A $7 gift earns 70 points, $12 earns 120, and $5.50 earns 55. Cents earn proportional points; $5.01 earns 50.1. Gifts below $5 earn zero and do not pool. Refunds and disputes recalculate points from eligible net funds. No real charge or refund is made for verification.

Policy 3 reconciles any existing donation ledger once without changing historical rate snapshots. Those snapshots retain their original points-per-$5 denomination; eligible amounts now receive the proportional rate. The migration protects against stale receipts and ledger entries. Existing daily awards, admissions, orders, QR tokens, brother records and funds are preserved when upgrading policy 2. Historical policy 1 can still receive the earlier reviewed daily/admissions migration.

Verification: 120 domain, HTTP and Postgres tests passed when run serially. The initial concurrent run hit the local macOS shared-memory limit rather than a scoring failure. Four compiled-production HTTPS browser tests passed in Chromium and mobile WebKit, covering seven widths (320–1440), accessibility, all three donation destinations, a synthetic $7 payment attributed through the staff desk to 70 public leaderboard points, and synthetic refund reconciliation. Mobile 390 and desktop 1440 donation-panel screenshots were visually inspected. Lint and the production build passed. Publication evidence follows after deployment.
