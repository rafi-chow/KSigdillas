"use client";
import { useState } from "react";
import { useLeaderboard } from "./useLeaderboard";
import { donationProducts, weekSchedule } from "@/lib/eventConfig";
import { defaultRules } from "@/lib/operations/rules";

const productNames: Record<string, string> = {
  cheese: "Shredded cheese",
  tortillas: "Flour tortillas",
  vegetables: "Peppers & onions",
  chicken: "Fajita chicken",
  steak: "Fajita steak",
  soda: "Soda",
  water: "Drinking water",
};
const days = [...new Set(weekSchedule.map((item) => item.day))];

export function EventGuide() {
  const { data } = useLeaderboard();
  const rules = data?.rules ?? defaultRules;
  const [day, setDay] = useState<"monday" | "other">("monday");
  return (
    <>
      <section
        className="section week-section"
        id="schedule"
        aria-labelledby="schedule-heading"
      >
        <div className="shell">
          <div className="section-heading">
            <p className="eyebrow">November 16–19 · All times Central</p>
            <h2 id="schedule-heading">This week.</h2>
          </div>
          <div className="agenda">
            {days.map((day) => (
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
      <section
        className="section donation-section"
        id="donations"
        aria-labelledby="supply-heading"
      >
        <div className="shell guide-layout">
          <div className="guide-intro">
            <p className="eyebrow">Chapter points</p>
            <h2 id="supply-heading">Supply guide.</h2>
            <p className="section-intro">
              Drop off Monday–Wednesday,
              <br />9 AM–3 PM at 707 S Davis Dr.
            </p>
            <p className="guide-cap-note">
              Monday caps are shared by your chapter across all donors and
              approved varieties. Excess supplies cannot be accepted and earn no
              points.
            </p>
          </div>
          <div className="guide-content">
            <fieldset className="guide-days">
              <legend>Points per package</legend>
              <div>
                <label>
                  <input
                    type="radio"
                    name="supply-day"
                    value="monday"
                    checked={day === "monday"}
                    onChange={() => setDay("monday")}
                  />
                  <span>Monday</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="supply-day"
                    value="other"
                    checked={day === "other"}
                    onChange={() => setDay("other")}
                  />
                  <span>Tue / Wed</span>
                </label>
              </div>
            </fieldset>
            <div className="supply-list" aria-live="polite" aria-atomic="false">
              {donationProducts.map((product) => {
                const rule = rules.find((r) => r.id === product.id);
                const enabled = product.enabled && rule?.enabled;
                const points =
                  day === "monday"
                    ? (rule?.mondayPoints ?? product.mondayPoints)
                    : rule?.points;
                return (
                  <article
                    className={`supply-item ${!enabled ? "pending-item" : ""}`}
                    key={product.id}
                    data-product={product.id}
                  >
                    <div className="supply-description">
                      <h3>{productNames[product.id]}</h3>
                      <p>{product.unit}</p>
                      {product.url && (
                        <details className="product-details">
                          <summary>Accepted products</summary>
                          <div>
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {product.name} ↗
                            </a>
                            {"alternateUrl" in product && (
                              <a
                                href={product.alternateUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Triple Cheddar option ↗
                              </a>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                    <div className="supply-points">
                      {enabled ? (
                        <>
                          <strong>
                            {points} <span>pts</span>
                          </strong>
                          <small>
                            {day === "monday" && rule?.mondayCap != null
                              ? `Cap ${rule.mondayCap} / chapter`
                              : "No cap"}
                          </small>
                        </>
                      ) : (
                        <span>Not accepting</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <details className="guide-disclosure">
              <summary>Collection rules</summary>
              <ul className="guide-copy">
                <li>
                  Bring the complete package listed. Each accepted bag or pack
                  counts as one item in your sorority’s box.
                </li>
                <li>
                  Monday caps apply per sorority across all donors and approved
                  varieties. Staff will refuse excess supplies.
                </li>
                <li>
                  Monday’s supply-box winner has the most accepted packages, not
                  the highest supply point total.
                </li>
              </ul>
            </details>
            <details className="guide-disclosure" id="activity-points">
              <summary>Activities &amp; contributions</summary>
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
                    {rules.find((r) => r.id === "donation")?.points ?? 50}{" "}
                    points per complete $5
                  </span>
                </p>
              </div>
              <p className="guide-copy">
                Instagram posts must tag @kappasigmauta and @movember.usa. Staff
                verifies each post once.
              </p>
            </details>
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
              <ul className="guide-copy">
                <li>
                  Monday: most accepted packages in the chapter’s supply box.
                </li>
                <li>
                  Tuesday: most money from pie/slap purchases only. Direct
                  donations and ticket sales do not count. Staff resolves ties.
                </li>
                <li>
                  Wednesday: one overall longest-hang winner. Each hanging
                  attempt also earns points.
                </li>
              </ul>
            </details>
            <div className="guide-award-note">
              <p>
                Attendance winner{" "}
                <strong>
                  {(
                    rules.find((r) => r.id === "award:attendance")?.points ??
                    1000
                  ).toLocaleString()}{" "}
                  pts
                </strong>
              </p>
              <p>
                Longest-hang award{" "}
                <strong>
                  {rules.find((r) => r.id === "award:hanging")?.points ?? 300}{" "}
                  pts
                </strong>
              </p>
            </div>
            <details className="guide-disclosure">
              <summary>Volleyball &amp; eating challenge rules</summary>
              <div className="contest-rules">
                <article>
                  <h3>Volleyball tournament</h3>
                  <p>
                    Thursday at 7 PM. 4v4 sand, first to 15, double elimination
                    (two games guaranteed). Championship and consolation results
                    award 400 / 200 / 100 points.
                  </p>
                </article>
                <article>
                  <h3>Eating challenge</h3>
                  <p>
                    10 quesadillas in 6 minutes. Fastest finish wins, followed
                    by most consumed. Referees verify results; two waters
                    provided. Placements award 400 / 200 / 100 points.
                  </p>
                </article>
              </div>
            </details>
            <p className="guide-footnote">
              Chapter representatives coordinate verified points for the Queso
              Queen award.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
