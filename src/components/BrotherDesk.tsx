"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { brotherReport } from "@/lib/operations/brothers";
type Report = ReturnType<typeof brotherReport>;
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
export function BrotherSelect({
  brothers,
  name = "brotherId",
  label = "Brother",
  value,
}: {
  brothers: { id: string; name: string }[];
  name?: string;
  label?: string;
  value?: string | null;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value ?? ""}>
        <option value="">No brother / unknown</option>
        {brothers.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function BrotherDesk({ onChange }: { onChange?: () => Promise<void> }) {
  const [report, setReport] = useState<Report | null>(null);
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState("ticketsSold");
  const [donationFilter, setDonationFilter] = useState("all");
  const [query, setQuery] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/operations/brothers", {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setReport(data);
  }, []);
  useEffect(() => {
    let active = true;
    void fetch("/api/operations/brothers", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((error) => {
        if (active) setNotice(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(path: string, body: unknown) {
    try {
      const response = await fetch(`/api/operations/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await refresh();
      await onChange?.();
      setNotice("Saved. Contribution totals reconciled.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save.");
    }
  }
  if (!report)
    return (
      <section className="ops-card">
        <p role="status">{notice || "Loading brother contributions…"}</p>
      </section>
    );
  const roster = report.roster.filter((b) => b.active);
  const filtered = report.rows
    .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const key = sort as
        | "ticketsSold"
        | "ticketRevenueCents"
        | "personallyDonatedCents"
        | "referredDonationCents";
      return b[key] - a[key] || a.name.localeCompare(b.name);
    });
  function rosterSubmit(
    e: FormEvent<HTMLFormElement>,
    id?: string,
    revision = 0,
  ) {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.currentTarget));
    void save("brother", {
      id,
      name: v.name,
      aliases: String(v.aliases)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      active: v.active === "on",
      revision,
      reason: v.reason,
    });
  }
  return (
    <>
      <section className="ops-card">
        <h2>BROTHER CONTRIBUTIONS</h2>
        <p>
          Ticket sales, verified personal donations and referred donations. A
          referral credits the brother who sent the donor; it does not mean the
          brother paid.
        </p>
        <p role="status">{notice}</p>
        <div className="ops-inline">
          <label>
            Find brother
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            Sort contributions
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="ticketsSold">Tickets sold</option>
              <option value="ticketRevenueCents">Ticket revenue</option>
              <option value="referredDonationCents">Referred donations</option>
              <option value="personallyDonatedCents">
                Personal cash donations
              </option>
            </select>
          </label>
        </div>
        <a className="ops-action" href="/api/operations/brothers.csv">
          Download brother CSV
        </a>
        <div className="ops-table-wrap">
          <table className="ops-table ops-responsive-table">
            <thead>
              <tr>
                <th>Brother</th>
                <th>Tickets sold</th>
                <th>Ticket revenue</th>
                <th>Personally donated</th>
                <th>Referred donations</th>
                <th>Donated packages / points</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.brotherId ?? "none"}>
                  <td data-label="Brother">
                    {row.name}
                    {!row.active ? " (archived)" : ""}
                  </td>
                  <td data-label="Tickets sold">{row.ticketsSold}</td>
                  <td data-label="Ticket revenue">
                    {money(row.ticketRevenueCents)}
                  </td>
                  <td data-label="Personally donated">
                    {money(row.personallyDonatedCents)}
                  </td>
                  <td data-label="Referred donations">
                    {money(row.referredDonationCents)} ·{" "}
                    {row.referredDonationCount}{" "}
                    {row.referredDonationCount === 1 ? "gift" : "gifts"}
                  </td>
                  <td data-label="Donated packages / points">
                    {Object.entries(row.goods).map(([key, item]) => (
                      <p key={key}>
                        {key} · {item.quantity} packages · {item.points} points
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ops-card">
        <h2>Online donations</h2>
        <p>
          50 chapter points per complete $5, calculated per donation. Gifts
          under $5 earn no points. Refunds and disputes update totals
          automatically.
        </p>
        <label>
          Donation status
          <select
            value={donationFilter}
            onChange={(e) => setDonationFilter(e.target.value)}
          >
            <option value="all">All donations</option>
            <option value="review">Needs review</option>
            <option value="paid">Paid</option>
            <option value="partially-refunded">Partially refunded</option>
            <option value="refunded">Refunded</option>
            <option value="disputed">Disputed</option>
          </select>
        </label>
        {!report.onlineDonations.length && <p>No online donations yet.</p>}
        {report.onlineDonations
          .filter(
            (d) =>
              donationFilter === "all" ||
              (donationFilter === "review" &&
                (d.review.length > 0 || d.error)) ||
              d.status === donationFilter,
          )
          .map((d) => (
            <details key={`${d.id}:${d.revision}`} className="donation-record">
              <summary>
                {money(d.amountCents)} ·{" "}
                {d.teamId?.toUpperCase() ?? "No chapter"} · {d.status}
                {d.review.length || d.error ? " · Needs review" : ""}
              </summary>
              <p>Reference: {d.id}</p>
              {d.receiptUrl && (
                <p>
                  <a
                    href={d.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Stripe receipt
                  </a>
                </p>
              )}
              <p>
                Refunded: {money(d.refundedCents)} · Referred by:{" "}
                {report.roster.find((b) => b.id === d.referrerBrotherId)
                  ?.name ?? "Unassigned"}
              </p>
              {d.referrerRaw && <p>Original referral: {d.referrerRaw}</p>}
              {d.review.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
              {d.error && <p role="status">{d.error}</p>}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Object.fromEntries(new FormData(e.currentTarget));
                  void save("donation-attribution", {
                    id: d.id,
                    revision: d.revision,
                    teamId: v.teamId || null,
                    brotherId: v.brotherId || null,
                    reason: v.reason,
                  });
                }}
              >
                <label>
                  Donation chapter
                  <select name="teamId" defaultValue={d.teamId ?? ""}>
                    <option value="">No chapter</option>
                    {["axo", "ddd", "dz", "zta"].map((id) => (
                      <option key={id} value={id}>
                        {id.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <BrotherSelect
                  brothers={roster}
                  value={d.referrerBrotherId}
                  label="Referring brother"
                />
                <label>
                  Donation correction reason
                  <input name="reason" required maxLength={300} />
                </label>
                <button className="ops-action">
                  Save donation attribution
                </button>
              </form>
            </details>
          ))}
      </section>
      <section className="ops-card">
        <h2>ROSTER</h2>
        <p>
          Add the actual brothers. Aliases match exactly after ignoring case and
          extra spaces; ambiguous names remain unassigned.
        </p>
        <form onSubmit={(e) => rosterSubmit(e)}>
          <label>
            Brother name
            <input name="name" maxLength={100} required />
          </label>
          <label>
            Aliases, separated by commas
            <input name="aliases" maxLength={1500} />
          </label>
          <label>
            <input name="active" type="checkbox" defaultChecked />
            Available for new sales
          </label>
          <label>
            Roster reason
            <input name="reason" required maxLength={300} />
          </label>
          <button className="ops-action">Add brother</button>
        </form>
        {report.roster.map((b) => (
          <details key={`${b.id}:${b.revision}`}>
            <summary>
              {b.name}
              {!b.active ? " · archived" : ""}
            </summary>
            <form onSubmit={(e) => rosterSubmit(e, b.id, b.revision)}>
              <label>
                Brother name
                <input
                  name="name"
                  defaultValue={b.name}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Aliases, separated by commas
                <input name="aliases" defaultValue={b.aliases.join(", ")} />
              </label>
              <label>
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={b.active}
                />
                Available for new sales
              </label>
              <label>
                Roster reason
                <input name="reason" required maxLength={300} />
              </label>
              <button className="ops-action">Save roster changes</button>
            </form>
          </details>
        ))}
      </section>
      <section className="ops-card">
        <h2>SALES ATTRIBUTION</h2>
        {report.orders.map((o) => (
          <details key={`${o.id}:${o.sellerRevision}`}>
            <summary>
              Order {o.id.slice(0, 8)} · {o.status} ·{" "}
              {report.roster.find((b) => b.id === o.sellerBrotherId)?.name ??
                "Unassigned"}
              {o.unresolved ? " · needs review" : ""}
            </summary>
            {o.sellerRaw && <p>Original answer: {o.sellerRaw}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = Object.fromEntries(new FormData(e.currentTarget));
                void save("seller", {
                  id: o.id,
                  brotherId: v.brotherId || null,
                  revision: o.sellerRevision,
                  reason: v.reason,
                });
              }}
            >
              <BrotherSelect
                brothers={roster}
                value={o.sellerBrotherId}
                label="Ticket seller"
              />
              <label>
                Attribution correction reason
                <input name="reason" required maxLength={300} />
              </label>
              <button className="ops-action">Correct seller</button>
            </form>
          </details>
        ))}
      </section>
      <section className="ops-card">
        <h2>DONOR ATTRIBUTION</h2>
        <p>
          Allocate only the verified source amount. Personal donor corrections
          leave event money and team scores unchanged.
        </p>
        {report.donations.map((source) => (
          <DonationAllocation
            key={`${source.id}:${source.attribution?.revision ?? 0}`}
            source={source}
            brothers={roster}
            save={save}
          />
        ))}
      </section>
    </>
  );
}
function DonationAllocation({
  source,
  brothers,
  save,
}: {
  source: Report["donations"][number];
  brothers: { id: string; name: string }[];
  save: (path: string, body: unknown) => Promise<void>;
}) {
  const cash = "cents" in source;
  const total = cash ? source.cents : source.quantity;
  const [rows, setRows] = useState(
    source.attribution?.allocations.map((a) => ({
      brotherId: a.brotherId,
      amount: String(cash ? a.units / 100 : a.units),
    })) ?? [{ brotherId: "", amount: "" }],
  );
  return (
    <details>
      <summary>
        {source.id.slice(0, 30)} · {cash ? money(total) : `${total} packages`}
        {source.reversedAt ? " · reversed" : ""}
      </summary>
      {!source.reversedAt && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = Object.fromEntries(new FormData(e.currentTarget));
            void save("donor", {
              id: source.id,
              kind: cash ? "receipt" : "entry",
              revision: source.attribution?.revision ?? 0,
              allocations: rows
                .filter((r) => r.brotherId)
                .map((r) => ({
                  brotherId: r.brotherId,
                  units: cash
                    ? Math.round(Number(r.amount) * 100)
                    : Number(r.amount),
                })),
              reason: v.reason,
            });
          }}
        >
          {rows.map((r, i) => (
            <div className="ops-inline" key={i}>
              <label>
                Donating brother
                <select
                  value={r.brotherId}
                  onChange={(e) =>
                    setRows(
                      rows.map((v, n) =>
                        n === i ? { ...v, brotherId: e.target.value } : v,
                      ),
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {brothers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {cash ? "Donated dollars" : "Donated packages"}
                <input
                  type="number"
                  min={cash ? "0.01" : "1"}
                  step={cash ? "0.01" : "1"}
                  value={r.amount}
                  onChange={(e) =>
                    setRows(
                      rows.map((v, n) =>
                        n === i ? { ...v, amount: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <button
                className="ops-action"
                type="button"
                onClick={() => setRows(rows.filter((_, n) => n !== i))}
              >
                Remove allocation
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ops-action"
            onClick={() => setRows([...rows, { brotherId: "", amount: "" }])}
          >
            Split with another donor
          </button>
          <label>
            Donor correction reason
            <input name="reason" required maxLength={300} />
          </label>
          <button className="ops-action">Save donor allocation</button>
        </form>
      )}
    </details>
  );
}
