"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import type QrScanner from "qr-scanner";
import type {
  Award,
  Audit,
  Job,
  LedgerEntry,
  Receipt,
  Role,
  Rule,
  Settings,
  TeamRecord,
  RemoteRefund,
  RecordedEntry,
} from "@/lib/operations/model";
import { eventConfig } from "@/lib/eventConfig";
import { KappaSigmaMark } from "./KappaSigmaMark";
import { AttendeeForm, type Attendee } from "./OrderForm";
import { BrotherDesk, BrotherSelect } from "./BrotherDesk";
import { socialRules } from "@/lib/operations/contests";
import { StripeRefundForm } from "./StripeRefundForm";
type Tab = "scores" | "scan" | "orders" | "settings" | "history" | "brothers";
type Desk = {
  user: { id: string; name: string; role: Role };
  teams: (TeamRecord & { totalPoints: number; attendance: number })[];
  rules: Rule[];
  awards: Award[];
  contests: {
    teamId: string;
    name: string;
    mondayPackages: number;
    tuesdayCents: number;
    hangMillis: number;
    caps: Record<string, number>;
  }[];
  ledger: LedgerEntry[];
  receipts: Receipt[];
  audit: Audit[];
  staff: { id: string; name: string; role: Role; active: boolean }[];
  jobs: Job[];
  brothers: { id: string; name: string }[];
  entries: RecordedEntry[];
  integrations?: {
    refundWriteEnabled?: boolean;
    pendingEvents: {
      id: string;
      type: string;
      status: string;
      error?: string;
    }[];
    refunds: RemoteRefund[];
    checkouts: {
      id: string;
      orderId: string;
      status: string;
      processorFeeCents?: number;
    }[];
    heartbeat?: string;
  };
  settings?: Settings;
  fundsRaisedCents: number;
};
type FoundOrder = {
  id: string;
  status: string;
  source: string;
  email?: string;
  baseCents?: number;
  feeCents?: number;
  refundedFeeCents?: number;
  tickets: {
    id: string;
    name: string;
    tier: string;
    teamId: string | null;
    valid: boolean;
    checkedInAt: string | null;
    refunded: boolean;
    baseCents?: number;
  }[];
};
const dollars = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(`/api/operations/${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return Object.fromEntries(new FormData(event.currentTarget));
}
export function EventDesk({ initialTab = "scores" }: { initialTab?: Tab }) {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(
    null,
  );
  const [orders, setOrders] = useState<FoundOrder[]>([]);
  const [query, setQuery] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const scanning = useRef(false);
  const [ruleId, setRuleId] = useState("cheese");
  const [quantity, setQuantity] = useState(1);
  const [entryTeamId, setEntryTeamId] = useState("axo");
  const [day, setDay] = useState("2026-11-16");
  const [attendees, setAttendees] = useState<Attendee[]>([
    { name: "", tier: "basic", teamId: null },
  ]);
  const requestKeys = useRef(new Map<string, string>());
  const refresh = useCallback(async () => {
    const data = await api<Desk>("desk");
    setDesk(data);
  }, []);
  useEffect(() => {
    void api<{ user: Desk["user"] | null }>("auth")
      .then(async (result) => {
        if (result.user) await refresh();
      })
      .catch((error) => setNotice({ error: true, text: error.message }))
      .finally(() => setChecking(false));
  }, [refresh]);
  useEffect(() => () => scanner.current?.destroy(), []);
  async function run(
    path: string,
    input: Record<string, unknown>,
    message = "Saved.",
    withKey = true,
  ) {
    setBusy(true);
    setNotice(null);
    const identity = path + JSON.stringify(input);
    let key = requestKeys.current.get(identity);
    if (!key) {
      key = crypto.randomUUID();
      requestKeys.current.set(identity, key);
    }
    try {
      const result = await api<{
        message?: string;
        orderUrl?: string;
        admitted?: boolean;
        ticket?: { name: string; tier: string; teamId: string | null };
      }>(path, { ...input, ...(withKey ? { requestKey: key } : {}) });
      requestKeys.current.delete(identity);
      const text = result.ticket
        ? `${result.message} ${result.ticket.name} · ${result.ticket.tier === "basic" ? "Basicdilla" : "Meat/Veggie Pass"} · ${result.ticket.teamId?.toUpperCase() ?? "No team"}`
        : message;
      setNotice({ error: result.admitted === false, text });
      await refresh();
      return result;
    } catch (error) {
      setNotice({
        error: true,
        text: error instanceof Error ? error.message : "Unable to save.",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function scan(value: string) {
    if (scanning.current) return;
    scanning.current = true;
    scanner.current?.stop();
    setCamera(false);
    try {
      await run("scan", { token: value }, "", false);
    } finally {
      scanning.current = false;
    }
  }
  async function scanImage(file: File) {
    try {
      const { default: Scanner } = await import("qr-scanner");
      const result = await Scanner.scanImage(file, {
        returnDetailedScanResult: true,
      });
      await scan(result.data);
    } catch {
      setNotice({
        error: true,
        text: "No readable ticket QR found in that image. Try a clearer image or use name lookup.",
      });
    }
  }
  async function startCamera() {
    setNotice(null);
    setCamera(true);
    try {
      if (!video.current)
        throw new Error(
          "Camera is unavailable. Use the ticket link or name lookup below.",
        );
      scanner.current?.destroy();
      const { default: Scanner } = await import("qr-scanner");
      scanner.current = new Scanner(
        video.current,
        (result) => void scan(result.data),
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          maxScansPerSecond: 3,
        },
      );
      await scanner.current.start();
    } catch {
      setCamera(false);
      setNotice({
        error: true,
        text: "Camera access is unavailable. Paste the ticket link or use name/order lookup.",
      });
    }
  }
  const teamOptions = desk?.teams.map((t) => (
    <option value={t.id} key={t.id}>
      {t.displayName}
    </option>
  ));
  const selectedRule = desk?.rules.find((r) => r.id === ruleId);
  const pending = busy ? "Working…" : "Save";
  if (checking)
    return (
      <main className="ops-page">
        <div className="shell">
          <p role="status">Checking staff access…</p>
        </div>
      </main>
    );
  if (!desk)
    return (
      <main className="ops-page">
        <div className="shell">
          <Link href="/">← Back to event</Link>
          <section className="ops-card ops-login">
            <KappaSigmaMark />
            <h1>STAFF DESK</h1>
            <p>Sign in with your individual staff credentials.</p>
            <form
              onSubmit={async (e) => {
                const input = values(e);
                setBusy(true);
                try {
                  await api("auth", input);
                  await refresh();
                  setNotice(null);
                } catch (error) {
                  setNotice({
                    error: true,
                    text:
                      error instanceof Error
                        ? error.message
                        : "Sign-in failed.",
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Staff ID
                <input
                  name="id"
                  required
                  autoComplete="username"
                  maxLength={100}
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  maxLength={256}
                />
              </label>
              <button className="button button-dark" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
            {notice && (
              <p className="ops-notice error" role="alert">
                {notice.text}
              </p>
            )}
          </section>
        </div>
      </main>
    );
  return (
    <main className="ops-page">
      <div className="shell">
        <header className="ops-header">
          <div>
            <Link href="/">← Event home</Link>
            <h1>
              KSIGDILLAS <em>STAFF DESK.</em>
            </h1>
            <p>
              {desk.user.name} · {desk.user.role}
            </p>
          </div>
          <div>
            <Link className="ops-action" href="/leaderboard">
              Public board
            </Link>
            <button
              className="ops-action"
              onClick={async () => {
                await api("auth", undefined, "DELETE");
                setDesk(null);
              }}
            >
              Log out
            </button>
          </div>
        </header>
        <nav className="ops-nav" aria-label="Staff tools">
          {(
            [
              "scan",
              "orders",
              ...(desk.user.role !== "check-in" ? ["scores"] : []),
              ...(desk.user.role === "organizer"
                ? ["brothers", "settings", "history"]
                : []),
            ] as Tab[]
          ).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tab === item}
              onClick={() => {
                setTab(item);
                setNotice(null);
              }}
            >
              {
                {
                  scan: "Check-in",
                  orders: "Orders & door sales",
                  scores: "Scorekeeping",
                  settings: "Rules & access",
                  history: "History & recovery",
                  brothers: "Brother contributions",
                }[item]
              }
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              void refresh().catch(() =>
                setNotice({ error: true, text: "Could not refresh the desk." }),
              )
            }
          >
            Refresh
          </button>
        </nav>
        {notice && (
          <p
            className={`ops-notice ${notice.error ? "error" : "success"}`}
            role="status"
          >
            {notice.text}
          </p>
        )}
        <div className="funds-raised">
          <strong>{dollars(desk.fundsRaisedCents)}</strong>
          <span>Funds raised, excluding service fees and taxes</span>
        </div>
        <fieldset
          disabled={busy}
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          {tab === "scan" && (
            <section className="ops-card">
              <h2>CHECK IN A TICKET</h2>
              <p>
                A successful scan admits one person. Check the tier before
                issuing their wristband.
              </p>
              <video
                className="ops-camera"
                ref={video}
                hidden={!camera}
                muted
                playsInline
                aria-label="Ticket camera"
              />
              <button
                className="button button-dark"
                type="button"
                onClick={() => void startCamera()}
              >
                Start camera
              </button>
              {camera && (
                <button
                  className="ops-action"
                  type="button"
                  onClick={() => {
                    scanner.current?.stop();
                    setCamera(false);
                  }}
                >
                  Stop camera
                </button>
              )}
              <label>
                Read a ticket QR image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void scanImage(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void scan(scanInput);
                }}
              >
                <label>
                  Ticket link or QR token
                  <input
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    required
                    maxLength={2048}
                  />
                </label>
                <button className="ops-action">Check ticket</button>
              </form>
              <p>
                Camera denied? Use the order lookup tab to find a guest by name
                or reference.
              </p>
            </section>
          )}
          {tab === "scores" && desk.user.role !== "check-in" && (
            <>
              <div className="rules-grid">
                {desk.teams.map((t) => (
                  <p key={t.id}>
                    <strong>
                      {t.displayName} · {t.totalPoints} points
                    </strong>
                    <span>{t.attendance} unique check-ins</span>
                  </p>
                ))}
              </div>
              <section className="ops-card">
                <h2>DAILY WINNER TOTALS</h2>
                <p>
                  Monday: reconcile each sorority box with accepted whole
                  packages. Tuesday: verified pie/slap money only, excluding
                  donations and ticket sales.
                </p>
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>Chapter box</th>
                        <th>Monday packages</th>
                        <th>Tuesday pie/slap</th>
                        <th>Longest hang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desk.contests.map((t) => (
                        <tr key={t.teamId}>
                          <td>{t.name}</td>
                          <td>{t.mondayPackages}</td>
                          <td>{dollars(t.tuesdayCents)}</td>
                          <td>
                            {t.hangMillis
                              ? `${t.hangMillis / 1000}s`
                              : "No timed entry"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="ops-grid">
                <section className="ops-card">
                  <h2>FOOD / ACTIVITY / SOCIAL</h2>
                  <form
                    onSubmit={(e) => {
                      const v = values(e);
                      void run("entry", {
                        teamId: v.teamId || null,
                        donorBrotherId:
                          selectedRule?.category === "giving"
                            ? v.donorBrotherId || null
                            : null,
                        ruleId,
                        quantity,
                        day,
                        reference: v.reference,
                        paymentVerified: v.paymentVerified === "on",
                        tagsVerified: v.tagsVerified === "on",
                        ...(v.participant
                          ? { participant: String(v.participant) }
                          : {}),
                        ...(v.hangSeconds
                          ? {
                              hangMillis: Math.round(
                                Number(v.hangSeconds) * 1000,
                              ),
                            }
                          : {}),
                      });
                    }}
                  >
                    <label>
                      Team
                      <select
                        name="teamId"
                        value={entryTeamId}
                        onChange={(e) => setEntryTeamId(e.target.value)}
                      >
                        <option value="">No team</option>
                        {teamOptions}
                      </select>
                    </label>
                    {selectedRule?.category === "giving" && (
                      <BrotherSelect
                        brothers={desk.brothers}
                        name="donorBrotherId"
                        label="Food donated by"
                      />
                    )}
                    <label>
                      Item or activity
                      <select
                        value={ruleId}
                        onChange={(e) => setRuleId(e.target.value)}
                      >
                        {desk.rules
                          .filter(
                            (r) =>
                              r.category !== "tickets" &&
                              r.category !== "bonuses" &&
                              r.category !== "eating" &&
                              r.id !== "donation",
                          )
                          .map((r) => (
                            <option
                              key={r.id}
                              value={r.id}
                              disabled={!r.enabled}
                            >
                              {r.label}
                              {!r.enabled ? " · disabled" : ""}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Event day
                      <select
                        value={day}
                        onChange={(e) => setDay(e.target.value)}
                      >
                        <option value="2026-11-16">Monday 11/16</option>
                        <option value="2026-11-17">Tuesday 11/17</option>
                        <option value="2026-11-18">Wednesday 11/18</option>
                      </select>
                    </label>
                    <label>
                      Quantity
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        required
                      />
                    </label>
                    <label>
                      Receipt / post reference or verification note
                      <input name="reference" required maxLength={300} />
                    </label>
                    {socialRules.includes(ruleId) && (
                      <label>
                        <input name="tagsVerified" type="checkbox" required />I
                        verified @kappasigmauta and @movember.usa are both
                        tagged.
                      </label>
                    )}
                    {ruleId === "hang" && (
                      <div className="ops-inline">
                        <label>
                          Hanging contender (for timed attempt)
                          <input name="participant" maxLength={100} />
                        </label>
                        <label>
                          Hang time in seconds (one attempt)
                          <input
                            name="hangSeconds"
                            type="number"
                            min="0.001"
                            max="86400"
                            step="0.001"
                          />
                        </label>
                      </div>
                    )}
                    {day === "2026-11-16" &&
                      selectedRule?.mondayCap != null && (
                        <p role="note">
                          Monday allowance remaining:{" "}
                          <strong>
                            {desk.contests.find((t) => t.teamId === entryTeamId)
                              ?.caps[ruleId] ?? selectedRule.mondayCap}
                          </strong>{" "}
                          of {selectedRule.mondayCap} packages for this chapter.
                          Refuse excess supplies; they earn no points. An
                          over-limit entry will be rejected.
                        </p>
                      )}
                    {!!selectedRule?.cents && (
                      <label>
                        <input
                          name="paymentVerified"
                          type="checkbox"
                          required
                        />
                        I verified {dollars(selectedRule.cents * quantity)} was
                        received.
                      </label>
                    )}
                    <p>
                      <strong>
                        Preview:{" "}
                        {(day === "2026-11-16"
                          ? (selectedRule?.mondayPoints ??
                            selectedRule?.points ??
                            0)
                          : (selectedRule?.points ?? 0)) * quantity}{" "}
                        points
                      </strong>
                      {!selectedRule?.cents && " · no cash receipt"}
                    </p>
                    <button className="button button-dark">{pending}</button>
                  </form>
                </section>
                <section className="ops-card">
                  <h2>MONETARY DONATION</h2>
                  <form
                    onSubmit={(e) => {
                      const v = values(e);
                      void run("donation", {
                        teamId: v.teamId || null,
                        donorBrotherId: v.donorBrotherId || null,
                        cents: Math.round(Number(v.amount) * 100),
                        reference: v.reference,
                      });
                    }}
                  >
                    <label>
                      Team
                      <select name="teamId" defaultValue="axo">
                        <option value="">No team</option>
                        {teamOptions}
                      </select>
                    </label>
                    <BrotherSelect
                      brothers={desk.brothers}
                      name="donorBrotherId"
                      label="Money donated by"
                    />
                    <label>
                      Verified amount received ($)
                      <input
                        name="amount"
                        type="number"
                        min="0.01"
                        max="100000"
                        step="0.01"
                        required
                      />
                    </label>
                    <label>
                      Receipt reference
                      <input name="reference" required maxLength={300} />
                    </label>
                    <p>
                      Only received money. Tickets and paid activities are
                      recorded separately. Points accumulate per complete $5.
                    </p>
                    <button className="button button-dark">
                      Record verified donation
                    </button>
                  </form>
                </section>
              </div>
              {desk.user.role === "organizer" && (
                <section className="ops-card">
                  <h2>FINALIZE OR CORRECT AN AWARD</h2>
                  <form
                    onSubmit={(e) => {
                      const v = values(e);
                      void run("award", {
                        ...v,
                        boxesVerified: v.boxesVerified === "on",
                      });
                    }}
                  >
                    <div className="ops-inline">
                      <label>
                        Contest
                        <select name="contest">
                          {desk.rules
                            .filter(
                              (r) => r.id.startsWith("award:") && r.enabled,
                            )
                            .map((r) => (
                              <option key={r.id} value={r.id.slice(6)}>
                                {r.label} · {r.points}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Winning team<select name="teamId">{teamOptions}</select>
                      </label>
                    </div>
                    <label>
                      Result / correction reason
                      <input name="reason" required maxLength={300} />
                    </label>
                    <label>
                      Official result evidence (contender/time, amount consumed
                      or placement)
                      <input name="evidence" required maxLength={500} />
                    </label>
                    <label>
                      <input name="boxesVerified" type="checkbox" />
                      For Monday: I reconciled all four physical box counts with
                      accepted packages.
                    </label>
                    <p>
                      Ties require your decision. Awards are recorded once;
                      correcting a winner reverses the previous award.
                    </p>
                    <button className="button button-dark">
                      Finalize result
                    </button>
                  </form>
                  {desk.awards.map((a) => (
                    <p key={a.id}>
                      {a.contest}: {a.teamId.toUpperCase()} · {a.points} points
                      {a.reviewRequired
                        ? " · REVIEW REQUIRED after a correction"
                        : ""}
                    </p>
                  ))}
                </section>
              )}
              <section className="ops-card">
                <h2>RECENT SCORE ENTRIES</h2>
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>Team / rule</th>
                        <th>Points / reason</th>
                        <th>Correction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desk.ledger.map((e) => (
                        <tr key={e.id}>
                          <td>
                            {e.teamId.toUpperCase()} · {e.rule}
                            <small>
                              {e.day} · {e.operator}
                            </small>
                          </td>
                          <td>
                            {e.points}
                            <small>{e.reason}</small>
                          </td>
                          <td>
                            {desk.user.role === "organizer" &&
                              !["tickets", "bonuses"].includes(e.category) &&
                              !e.reversalOf && (
                                <button
                                  className="ops-action"
                                  type="button"
                                  onClick={() => {
                                    const reason = prompt(
                                      "Reason for reversing this entry?",
                                    );
                                    if (reason)
                                      void run("reverse", { id: e.id, reason });
                                  }}
                                >
                                  Reverse
                                </button>
                              )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {tab === "orders" && (
            <>
              <section className="ops-card">
                <h2>FIND AN ORDER</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      setOrders(
                        (
                          await api<{ orders: FoundOrder[] }>(
                            `orders?q=${encodeURIComponent(query)}`,
                          )
                        ).orders,
                      );
                      setNotice(null);
                    } catch (error) {
                      setNotice({
                        error: true,
                        text:
                          error instanceof Error
                            ? error.message
                            : "Lookup failed.",
                      });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Guest name, order reference
                    {desk.user.role !== "check-in" && ", or email"}
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      required
                      minLength={2}
                      maxLength={254}
                    />
                  </label>
                  <button className="button button-dark">Search orders</button>
                </form>
                {orders.length === 0 && <p>No matching orders loaded.</p>}
                {orders.map((o) => (
                  <article className="ops-ticket" key={o.id}>
                    <h3>Order {o.id}</h3>
                    <p>
                      {o.status} · {o.source} {o.email ? `· ${o.email}` : ""}
                    </p>
                    {desk.user.role === "organizer" && (
                      <button
                        className="ops-action"
                        type="button"
                        onClick={() =>
                          void run(
                            "resend",
                            { id: o.id },
                            "Ticket email queued.",
                          )
                        }
                      >
                        Resend tickets
                      </button>
                    )}
                    {o.tickets.map((t) => (
                      <div className="ops-ticket" key={t.id}>
                        <strong>
                          {t.name} ·{" "}
                          {t.tier === "basic"
                            ? "Basicdilla"
                            : "Meat/Veggie Pass"}{" "}
                          · {t.teamId?.toUpperCase() ?? "No team"}
                        </strong>
                        <small>
                          {t.id} · {t.valid ? "Valid" : "Not valid"}
                          {t.checkedInAt ? " · already checked in" : ""}
                        </small>
                        <button
                          className="ops-action"
                          type="button"
                          disabled={!t.valid || !!t.checkedInAt}
                          onClick={() =>
                            void run("lookup-scan", { id: t.id }, "", false)
                          }
                        >
                          Check in this guest
                        </button>
                        {desk.user.role === "organizer" && (
                          <>
                            {t.checkedInAt && (
                              <button
                                className="ops-action"
                                type="button"
                                onClick={() => {
                                  const reason = prompt(
                                    "Reason for correcting this check-in?",
                                  );
                                  if (reason)
                                    void run(
                                      "reverse-check-in",
                                      { id: t.id, reason },
                                      "Check-in corrected.",
                                      false,
                                    );
                                }}
                              >
                                Correct check-in
                              </button>
                            )}
                            <button
                              className="ops-action"
                              type="button"
                              onClick={() => {
                                const teamId = prompt(
                                  "Correct team: axo, dz, zta, ddd, or blank for no team",
                                  t.teamId ?? "",
                                );
                                if (teamId === null) return;
                                const reason = prompt(
                                  "Reason for correcting this ticket's team?",
                                );
                                if (reason)
                                  void run(
                                    "transfer-ticket",
                                    {
                                      id: t.id,
                                      teamId:
                                        teamId.trim().toLowerCase() || null,
                                      reason,
                                    },
                                    "Ticket team corrected; search again to refresh.",
                                    false,
                                  );
                              }}
                            >
                              Correct team
                            </button>
                            {!t.checkedInAt && t.valid && (
                              <button
                                className="ops-action"
                                type="button"
                                onClick={() => {
                                  const reason = prompt(
                                    "Replace this lost ticket and revoke its old QR. Reason?",
                                  );
                                  if (reason)
                                    void run(
                                      "replace-ticket",
                                      { id: t.id, reason },
                                      "Old QR revoked. Resend the new ticket.",
                                      false,
                                    );
                                }}
                              >
                                Replace lost QR
                              </button>
                            )}
                            {o.source === "cash" && !t.refunded && (
                              <button
                                className="ops-action"
                                type="button"
                                onClick={() => {
                                  const reason = prompt(
                                    "After returning the cash, enter the exceptional refund reason:",
                                  );
                                  if (reason)
                                    void run(
                                      "cash-refund",
                                      {
                                        id: o.id,
                                        ticketIds: [t.id],
                                        cashReturned: true,
                                        reason,
                                      },
                                      "Cash refund recorded. Search again to refresh this order.",
                                    );
                                }}
                              >
                                Record returned cash
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {desk.user.role === "organizer" &&
                      o.source === "stripe" &&
                      desk.integrations?.refundWriteEnabled &&
                      ["paid", "partially-refunded"].includes(o.status) && (
                        <StripeRefundForm
                          order={o}
                          save={(path, body) =>
                            void run(
                              path,
                              body,
                              "Refund submitted; search again to refresh.",
                            )
                          }
                        />
                      )}
                    {desk.user.role === "organizer" &&
                      desk.integrations?.refunds
                        .filter(
                          (r) => r.orderId === o.id && r.status === "review",
                        )
                        .map((r) => (
                          <StripeRefundForm
                            key={r.id}
                            order={o}
                            allocation={r}
                            save={(path, body) =>
                              void run(
                                path,
                                body,
                                "Confirmed refund allocated.",
                                false,
                              )
                            }
                          />
                        ))}
                  </article>
                ))}
              </section>
              {desk.user.role === "organizer" && (
                <section className="ops-card">
                  <h2>CASH DOOR SALE</h2>
                  <p>
                    $12 Basicdilla / $18 Meat-Veggie · Thursday, 6–9 PM. Card
                    checkout will become available after payments are connected.
                  </p>
                  <form
                    onSubmit={async (e) => {
                      const v = values(e);
                      const result = await run(
                        "cash-sale",
                        {
                          email: v.email,
                          attendees,
                          sellerBrotherId: v.sellerBrotherId || null,
                          paymentVerified: v.verified === "on",
                        },
                        "Cash sale recorded. Ticket email queued.",
                      );
                      if (result?.orderUrl)
                        window.open(result.orderUrl, "_blank", "noopener");
                    }}
                  >
                    <label>
                      Buyer email
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                      />
                    </label>
                    <AttendeeForm
                      attendees={attendees}
                      onChange={setAttendees}
                      teams={desk.teams}
                    />
                    <BrotherSelect
                      brothers={desk.brothers}
                      name="sellerBrotherId"
                      label="Which brother sold you your ticket?"
                    />
                    <p>
                      <strong>
                        Collect{" "}
                        {dollars(
                          attendees.reduce(
                            (sum, a) =>
                              sum + (a.tier === "basic" ? 1200 : 1800),
                            0,
                          ),
                        )}{" "}
                        cash
                      </strong>
                    </p>
                    <label>
                      <input name="verified" type="checkbox" required />I
                      received and verified this cash.
                    </label>
                    <button
                      className="button button-dark"
                      disabled={!desk.settings?.offlineSalesEnabled}
                    >
                      Issue paid tickets
                    </button>
                    {!desk.settings?.offlineSalesEnabled && (
                      <p>Cash sales are disabled in event settings.</p>
                    )}
                  </form>
                </section>
              )}
            </>
          )}
          {tab === "brothers" && desk.user.role === "organizer" && (
            <BrotherDesk onChange={refresh} />
          )}
          {tab === "settings" && desk.user.role === "organizer" && (
            <>
              <section className="ops-card">
                <h2>EVENT SETTINGS</h2>
                <form
                  onSubmit={(e) => {
                    const v = values(e);
                    void run(
                      "settings",
                      {
                        revision: desk.settings!.revision,
                        offlineSalesEnabled: v.enabled === "on",
                        reason: v.reason,
                      },
                      "Settings saved.",
                      false,
                    );
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={desk.settings?.offlineSalesEnabled}
                    />
                    Enable verified cash door sales (still restricted to
                    Thursday, 6–9 PM)
                  </label>
                  <label>
                    Change reason
                    <input name="reason" required maxLength={300} />
                  </label>
                  <button className="button button-dark">
                    Save event settings
                  </button>
                </form>
                <p>
                  Check the purchase page for online checkout availability. Keep
                  payment and email recovery running when new sales are paused.
                </p>
              </section>
              <section className="ops-card">
                <h2>CHAPTER REPRESENTATIVES / QUESO QUEEN</h2>
                <p>Private organizer contact and contender record.</p>
                {desk.teams.map((t) => {
                  const rep = desk.settings?.chapterRepresentatives?.find(
                    (r) => r.teamId === t.id,
                  );
                  return (
                    <form
                      className="ops-ticket"
                      key={`${t.id}:${desk.settings?.revision}`}
                      onSubmit={(e) => {
                        const v = values(e);
                        void run(
                          "chapter-representative",
                          {
                            ...v,
                            teamId: t.id,
                            revision: desk.settings!.revision,
                          },
                          "Representative saved.",
                          false,
                        );
                      }}
                    >
                      <h3>{t.displayName}</h3>
                      <label>
                        Representative / contender name
                        <input
                          name="name"
                          required
                          maxLength={100}
                          defaultValue={rep?.name ?? ""}
                        />
                      </label>
                      <label>
                        Private contact
                        <input
                          name="contact"
                          required
                          maxLength={200}
                          defaultValue={rep?.contact ?? ""}
                        />
                      </label>
                      <label>
                        Change reason
                        <input name="reason" required maxLength={300} />
                      </label>
                      <button className="ops-action">
                        Save representative
                      </button>
                    </form>
                  );
                })}
              </section>
              <section className="ops-card">
                <h2>EDIT SCORING RULES</h2>
                <p>
                  Changes apply to future entries. Historical entries retain the
                  points recorded at the time.
                </p>
                {desk.rules.map((r) => (
                  <form
                    className="ops-ticket"
                    key={`${r.id}:${r.revision}`}
                    onSubmit={(e) => {
                      const v = values(e);
                      void run(
                        "rule",
                        {
                          id: r.id,
                          revision: r.revision,
                          points: Number(v.points),
                          ...(r.mondayPoints !== undefined
                            ? { mondayPoints: Number(v.mondayPoints) }
                            : {}),
                          enabled: v.enabled === "on",
                          reason: v.reason,
                        },
                        "Rule updated.",
                        false,
                      );
                    }}
                  >
                    <h3>
                      {r.label} · revision {r.revision}
                    </h3>
                    <div className="ops-inline">
                      <label>
                        Ordinary points
                        <input
                          type="number"
                          name="points"
                          defaultValue={r.points}
                          min={0}
                          max={10000}
                          required
                        />
                      </label>
                      {r.mondayPoints !== undefined && (
                        <label>
                          Monday points
                          <input
                            type="number"
                            name="mondayPoints"
                            defaultValue={r.mondayPoints}
                            min={0}
                            max={20000}
                            required
                          />
                        </label>
                      )}
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        name="enabled"
                        defaultChecked={r.enabled}
                        disabled={r.id === "steak"}
                      />
                      Enabled
                      {r.id === "steak"
                        ? " · awaiting product/package details"
                        : ""}
                    </label>
                    <label>
                      Change reason
                      <input name="reason" required maxLength={300} />
                    </label>
                    <button className="ops-action">Save rule</button>
                  </form>
                ))}
              </section>
              <section className="ops-card">
                <h2>STAFF ACCESS</h2>
                <form
                  onSubmit={(e) => {
                    const v = values(e);
                    void run("staff", v, "Staff member created.", false);
                  }}
                >
                  <label>
                    Staff ID
                    <input name="id" pattern="[a-z0-9-]{3,50}" required />
                  </label>
                  <label>
                    Name
                    <input name="name" maxLength={100} required />
                  </label>
                  <label>
                    Role
                    <select name="role">
                      <option value="check-in">Check-in</option>
                      <option value="scorer">Scorer</option>
                      <option value="organizer">Organizer</option>
                    </select>
                  </label>
                  <label>
                    Temporary password (share securely)
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      maxLength={256}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <button className="button button-dark">
                    Create staff member
                  </button>
                </form>
                {desk.staff.map((u) => (
                  <p key={u.id}>
                    {u.name} · {u.role} · {u.active ? "Active" : "Revoked"}{" "}
                    {u.active && u.id !== desk.user.id && (
                      <button
                        className="ops-action"
                        type="button"
                        onClick={() =>
                          void run(
                            "revoke-staff",
                            { id: u.id },
                            "Access revoked.",
                            false,
                          )
                        }
                      >
                        Revoke access
                      </button>
                    )}
                  </p>
                ))}
              </section>
            </>
          )}
          {tab === "history" && desk.user.role === "organizer" && (
            <>
              <section className="ops-card">
                <h2>EXPORT & DELIVERY</h2>
                <p>
                  Exports contain attendee information. Keep them private and
                  delete local copies after the event.
                </p>
                <a
                  className="ops-action"
                  href="/api/operations/export"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open check-in manifest
                </a>
                <h3>Email jobs</h3>
                {desk.jobs.length === 0 && <p>No emails queued.</p>}
                {desk.jobs.map((j) => (
                  <p key={j.id}>
                    {j.orderId} · {j.status} · {j.attempts} attempts
                    {j.deliveryStatus ? ` · ${j.deliveryStatus}` : ""}
                    {j.lastError ? ` · ${j.lastError}` : ""}
                    {(j.status === "failed" || j.uncertain) && (
                      <>
                        <button
                          className="ops-action"
                          type="button"
                          onClick={() => {
                            const reason = prompt(
                              "After checking provider logs and confirming this was not accepted, enter the retry reason:",
                            );
                            if (reason)
                              void run(
                                "resolve-email",
                                { id: j.id, retry: true, reason },
                                "Email retry queued.",
                                false,
                              );
                          }}
                        >
                          Retry after checking provider
                        </button>
                        {j.uncertain && (
                          <button
                            className="ops-action"
                            type="button"
                            onClick={() => {
                              const providerRef = prompt(
                                "Provider message ID confirming this email was accepted:",
                              );
                              const reason = providerRef
                                ? prompt("Resolution reason:")
                                : null;
                              if (providerRef && reason)
                                void run(
                                  "resolve-email",
                                  {
                                    id: j.id,
                                    retry: false,
                                    providerRef,
                                    reason,
                                  },
                                  "Provider acceptance recorded.",
                                  false,
                                );
                            }}
                          >
                            Record confirmed acceptance
                          </button>
                        )}
                      </>
                    )}
                  </p>
                ))}
                <h3>Entries without a team</h3>
                {desk.entries
                  .filter((e) => !e.teamId)
                  .map((e) => (
                    <p key={e.id}>
                      {e.ruleId} · {e.quantity} · {e.day} · {e.reference}
                      {e.reversedAt ? (
                        " · reversed"
                      ) : (
                        <button
                          className="ops-action"
                          type="button"
                          onClick={() => {
                            const reason = prompt(
                              "Reverse this entry. Reason?",
                            );
                            if (reason)
                              void run(
                                "reverse",
                                { id: e.id, reason },
                                "Entry reversed.",
                              );
                          }}
                        >
                          Reverse entry
                        </button>
                      )}
                    </p>
                  ))}
                <h3>Payment recovery</h3>
                <p><a href="/admin/launch">Review launch readiness</a></p>
                {!desk.integrations?.refundWriteEnabled && <p>Stripe refunds are handled by the account owner. Confirmed refunds are reconciled here; no refund-write access is enabled.</p>}
                <p>
                  Last healthy maintenance run:{" "}
                  {desk.integrations?.heartbeat ?? "Not observed yet"}.
                  Configure an independent monitor for a missing heartbeat.
                </p>
                {desk.integrations?.pendingEvents.map((e) => (
                  <p key={e.id}>
                    {e.type} · {e.status} ·{" "}
                    {e.error ?? "Awaiting reconciliation"}
                  </p>
                ))}
                {desk.integrations?.refunds.map((r) => (
                  <p key={r.id}>
                    Refund {r.id} · {r.status} · {dollars(r.amountCents)} ·
                    order {r.orderId}
                    {r.status === "review"
                      ? " · Search this order to allocate the confirmed refund."
                      : ""}
                  </p>
                ))}
                <h3>Processor fees (private)</h3>
                {desk.integrations?.checkouts
                  .filter((c) => c.processorFeeCents !== undefined)
                  .map((c) => (
                    <p key={c.id}>
                      Order {c.orderId} · actual Stripe fee{" "}
                      {dollars(c.processorFeeCents!)} · {c.status}
                    </p>
                  ))}
              </section>
              <section className="ops-card">
                <h2>AUDIT HISTORY</h2>
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>Time / operator</th>
                        <th>Action</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desk.audit.map((a) => (
                        <tr key={a.id}>
                          <td>
                            {new Date(a.createdAt).toLocaleString()}
                            <small>{a.operator}</small>
                          </td>
                          <td>
                            {a.action}
                            <small>{a.subject}</small>
                          </td>
                          <td>{a.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </fieldset>
        <p className="ops-muted">
          Support:{" "}
          <a href={`mailto:${eventConfig.contactEmail}`}>
            {eventConfig.contactEmail}
          </a>
        </p>
      </div>
    </main>
  );
}
