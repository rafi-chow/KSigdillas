"use client";
import { useLeaderboard } from "./useLeaderboard";
import { donationProducts, weekSchedule } from "@/lib/eventConfig";
import { defaultRules } from "@/lib/operations/rules";
export function EventGuide() {
  const { data } = useLeaderboard();
  const rules = data?.rules ?? defaultRules;
  return (
    <>
      <section className="section week-section" id="schedule">
        <div className="shell">
          <div className="section-heading">
            <p className="eyebrow">
              <span />
              November 16–19 · All times Central
            </p>
            <h2>
              THIS <em>WEEK.</em>
            </h2>
          </div>
          <div className="agenda">
            {[...new Set(weekSchedule.map((item) => item.day))].map((day) => (
              <article className="agenda-day" key={day}>
                <h3>{day}</h3>
                <div>
                  {weekSchedule
                    .filter((item) => item.day === day)
                    .map((item) => (
                      <div className="agenda-item" key={item.title}>
                        <strong className="agenda-time">{item.time}</strong>
                        <div>
                          <h4>{item.title}</h4>
                          <p>{item.location}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section donation-section" id="donations">
        <div className="shell">
          <div className="section-heading">
            <p className="eyebrow">
              <span />
              Accepted packages · points · chapter caps
            </p>
            <h2>
              THE DONATION <em>GUIDE.</em>
            </h2>
            <p>
              One complete package earns the points below. Drop off
              Monday–Wednesday, 9 AM–3 PM at the backyard.
            </p>
          </div>
          <div className="donation-table-wrap">
            <table className="donation-table">
              <caption>Food and drink points per package</caption>
              <thead>
                <tr>
                  <th scope="col">What to bring</th>
                  <th scope="col">Monday</th>
                  <th scope="col">Tue / Wed</th>
                  <th scope="col">Monday cap / chapter</th>
                </tr>
              </thead>
              <tbody>
                {donationProducts.map((product) => {
                  const rule = rules.find((r) => r.id === product.id);
                  const enabled = product.enabled && rule?.enabled;
                  return (
                    <tr
                      key={product.id}
                      className={!enabled ? "pending-item" : ""}
                    >
                      <th scope="row">
                        {product.url ? (
                          <a
                            href={product.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {product.name} ↗
                          </a>
                        ) : (
                          product.name
                        )}
                        <small>{product.unit}</small>
                        {"alternateUrl" in product && (
                          <a
                            className="product-alternative"
                            href={product.alternateUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Triple Cheddar option ↗
                          </a>
                        )}
                      </th>
                      <td>
                        {enabled
                          ? (rule?.mondayPoints ?? product.mondayPoints)
                          : "Coming soon"}
                      </td>
                      <td>{enabled ? rule?.points : "—"}</td>
                      <td>{enabled ? (rule?.mondayCap ?? "No cap") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>
            Monday caps apply to each sorority across all donors and approved
            varieties. We cannot accept supplies above the cap, and excess earns
            no points. Each complete bag or pack counts as one item in your
            sorority’s box.
          </p>
          <p>
            Monday’s 500-point winner has the most accepted packages in its box.
            Tuesday’s 300-point winner raises the most money from pie/slap
            purchases only. Direct donations and ticket sales do not count
            toward Tuesday’s contest. Staff resolves ties.
          </p>
          <p>
            Instagram posts must tag @kappasigmauta and @movember.usa. Staff
            verifies each post once. Chapter representatives coordinate point
            updates and compete for Queso Queen.
          </p>
          <p>
            Attendance winner: 1,000 points. Wednesday’s overall longest-hang
            winner: 300 points. Each hanging attempt earns 10 points.
          </p>
          <h3 className="guide-subheading">Activities &amp; contributions</h3>
          <div className="rules-list">
            {rules
              .filter(
                (r) =>
                  ["slap", "pie", "hang", "story", "reel", "feed"].includes(
                    r.id,
                  ) && r.enabled,
              )
              .map((r) => (
                <p key={r.id}>
                  <strong>{r.label}</strong>
                  <span>
                    {r.points} points
                    {["slap", "pie"].includes(r.id)
                      ? " · $2 each"
                      : r.id === "hang"
                        ? " per attempt"
                        : " per verified post"}
                  </span>
                </p>
              ))}
            <p>
              <strong>Monetary donations</strong>
              <span>
                {rules.find((r) => r.id === "donation")?.points ?? 50} points
                per complete $5
              </span>
            </p>
          </div>
          <details className="guide-disclosure">
            <summary>Contest awards &amp; points</summary>
            <div className="rules-list">
              {rules
                .filter((r) => r.id.startsWith("award:") && r.enabled)
                .map((r) => (
                  <p key={r.id}>
                    <strong>{r.label}</strong>
                    <span>{r.points.toLocaleString()} points</span>
                  </p>
                ))}
            </div>
          </details>
        </div>
        <div className="shell contest-rules">
          <article>
            <h3>Volleyball tournament</h3>
            <p>
              Thursday at 7 PM · 4v4 sand · first to 15 · double elimination
              (two games guaranteed). Championship and consolation results award
              400 / 200 / 100 points.
            </p>
          </article>
          <article>
            <h3>Eating challenge</h3>
            <p>
              10 quesadillas in 6 minutes. Fastest finish wins, followed by most
              consumed. Referees verify results; two waters provided. Placements
              award 400 / 200 / 100 points.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
