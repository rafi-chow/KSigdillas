import type { Metadata } from "next";
import "./globals.css";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "KSigdillas | Kappa Sigma Theta-Omega",
  description:
    "KSigdillas supports Movember. November 19, 2026, 6–9 PM at 707 S Davis Dr, Arlington. Quesadillas, volleyball, and a week of giving.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await headers(); // Per-request CSP nonces require dynamic rendering.
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><a className="skip-link" href="#main-content">Skip to content</a>{process.env.EVENT_PREVIEW === "true" && <div className="preview-banner">Local preview · synthetic tickets and scores · payments unavailable</div>}{children}</body>
    </html>
  );
}
