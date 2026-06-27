import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KSigdillas | Kappa Sigma Theta-Omega",
  description:
    "Quesadillas, hoops, volleyball, and philanthropy. Join Kappa Sigma Theta-Omega for KSigdillas.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
