"use client";

import { ArrowRight } from "lucide-react";
import { useLeaderboard } from "./useLeaderboard";
import { centralTime } from "@/lib/centralTime";

function teamInitials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function LeaderboardPreview() {
  const { data, error } = useLeaderboard();
  const teams = data?.teams ?? [];
  const funds = data?.fundsRaisedCents;
  const lastUpdated = data?.lastUpdated;

  const max = teams[0]?.totalPoints || 1;

  return (
    <section className="leaderboard-section section" id="leaderboard">
      <div className="shell">
        <div className="section-heading section-heading-light">
          <p className="eyebrow light">
            <span />
            Live competition
          </p>
          <h2>
            CHAPTER <em>STANDINGS.</em>
          </h2>
          <p>
            Four chapters. Verified ticket, activity, and contribution points.
          </p>
        </div>

        {funds !== undefined && (
          <div className="funds-raised">
            <strong>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(funds / 100)}
            </strong>
            <span>
              Event receipts · before event costs or charity transfers;
              excluding processing fees and taxes
            </span>
          </div>
        )}
        {error && (
          <p className="board-message" role="status">
            Scores are temporarily unavailable. Showing the last available
            update.
          </p>
        )}
        <div className="leaderboard-card">
          <div className="leaderboard-head">
            <div>
              <span className="live-dot" /> Live standings
            </div>
            <p>
              {lastUpdated
                ? `Updated ${centralTime(lastUpdated)}`
                : "Loading live scores…"}
            </p>
          </div>
          <div className="leaderboard-labels">
            <span>Rank / Chapter</span>
            <span>Activities</span>
            <span>Attendance</span>
            <span>Support</span>
            <span>Total</span>
          </div>
          {teams.length === 0 ? (
            <div className="leaderboard-loading">
              Fetching the latest standings…
            </div>
          ) : (
            teams.map((team, index) => (
              <article className="leaderboard-row" key={team.id}>
                <div className="team-cell">
                  <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                  <span
                    className="chapter-mark"
                    style={{ backgroundColor: team.accentColor }}
                  >
                    {teamInitials(team.displayName)}
                  </span>
                  <span>
                    <strong>{team.displayName}</strong>
                  </span>
                </div>
                <span data-label="Activities">
                  {team.volleyballPoints + team.eatingCompetitionPoints}
                </span>
                <span data-label="Attendance">{team.attendance ?? 0}</span>
                <span data-label="Support">
                  {team.ticketPoints + team.donationPoints + team.bonusPoints}
                </span>
                <strong className="total" data-label="Total">
                  {team.totalPoints}
                </strong>
                <div
                  className="score-bar"
                  style={{ width: `${(team.totalPoints / max) * 100}%` }}
                />
              </article>
            ))
          )}
          <div className="leaderboard-foot">
            <span>
              Updates every 30 seconds while visible; delayed during connection
              problems.
            </span>
            <a href="/leaderboard">
              View full leaderboard <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
