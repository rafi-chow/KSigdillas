import { AdminLeaderboard } from "@/components/AdminLeaderboard";
import { EventDesk } from "@/components/EventDesk";
import { operationsEnabled } from "@/lib/operations/store";
export const dynamic = "force-dynamic";
export default function AdminPage() { return operationsEnabled() ? <EventDesk /> : <AdminLeaderboard />; }
