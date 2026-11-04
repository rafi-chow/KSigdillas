import Link from "next/link";
import { LaunchStatus } from "@/components/LaunchStatus";
export const metadata = {
  title: "Launch readiness | KSigdillas",
  robots: { index: false, follow: false },
};
export default function LaunchPage() {
  return (
    <main id="main-content" className="ops-page" tabIndex={-1}>
      <div className="shell ticket-page">
        <section className="ops-card">
          <h1>Launch readiness</h1>
          <LaunchStatus />
          <Link href="/admin/leaderboard">Staff sign-in and event desk</Link>
        </section>
      </div>
    </main>
  );
}
