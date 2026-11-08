# Hero donation link — November 8, 2026

The hero retains Buy tickets as its primary button and See the week’s events as its secondary button. A smaller, underlined Donate link sits directly below them and opens the same approved Stripe donation link as the donation panel and footer cause section. It has a vector icon, visible keyboard focus and a minimum 44-pixel tap target. There are now three donation links on the homepage.

This keeps event information accessible and makes donating available immediately without adding a third full-width button. The red brand, logo and floating cheese remain in place.

Six focused Chromium/mobile WebKit checks passed against the compiled production build over isolated HTTPS. Tests cover all ticket destinations, donation navigation, event scrolling, keyboard focus, no horizontal overflow, homepage accessibility and legacy checkout redirects. Hero screenshots at 320/375/390/430/768/1280/1440 pixels were captured; mobile and desktop images were visually inspected. Lint and the production build passed. No payment or database change was required.

[Mobile preview](images/hero-donate-mobile-2026-11-08.png). Deployment verification is recorded after publication.
