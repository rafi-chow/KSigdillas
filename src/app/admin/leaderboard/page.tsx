import type { Metadata } from "next";
import { AdminLeaderboard } from "@/components/AdminLeaderboard";

export const metadata: Metadata = {
  title: "Leaderboard Admin | KSigdillas",
  robots: { index: false, follow: false },
};

export default function AdminLeaderboardPage() {
  return <AdminLeaderboard />;
}
