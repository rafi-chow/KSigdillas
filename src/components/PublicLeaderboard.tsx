"use client";

import { useLeaderboard, refreshLeaderboard } from "./useLeaderboard";
import { centralTime as formatUpdatedAt } from "@/lib/centralTime";
import Link from "next/link";
import { ArrowLeft, Clock3, RefreshCw, Ticket } from "lucide-react";
import { scoringConfig } from "@/lib/scoringConfig";
import { scoreCategories, type LeaderboardResponse } from "@/types/leaderboard";
import { KappaSigmaMark } from "@/components/KappaSigmaMark";

const visibleCategories = scoreCategories;
function teamInitials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function PublicLeaderboard({
  initialData,
  ticketUrl,
}: {
  initialData: LeaderboardResponse;
  ticketUrl: string;
}) {
  const live = useLeaderboard();
  const data = live.data ?? initialData;
  const refreshing = live.refreshing;
  const error = live.error
    ? "Could not refresh right now. Showing the last available scores."
    : "";
  const refresh = () => void refreshLeaderboard();

  const leader = data.teams[0];
  const remainingTeams = data.teams;
  const maxTotal = leader?.totalPoints || 1;

  return (
    <main id="main-content" tabIndex={-1} className="public-board-page">
      <header className="board-nav shell">
        <Link href="/" className="brand">
          <KappaSigmaMark />
          <span>KSIGDILLAS</span>
        </Link>
        <div className="board-nav-actions">
          <Link href="/" className="board-back">
            <ArrowLeft size={16} /> Event home
          </Link>
          <a href={ticketUrl} className="button button-cheese">
            Ticket Details <Ticket size={17} />
          </a>
        </div>
      </header>

      <section className="board-hero shell">
        <div>
          <p className="eyebrow light">
            <span />
            Live chapter competition
          </p>
          <h1>
            THE <em>LEADERBOARD.</em>
          </h1>
          <p>
            Ticket, activity, and contribution points for each chapter. All
            times Central.
          </p>
        </div>
        <div className="board-status">
          <span className="live-dot" />
          <div>
            <strong>Live standings</strong>
            <span>
              <Clock3 size={13} /> Updated {formatUpdatedAt(data.lastUpdated)}
            </span>
          </div>
          <button type="button" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "is-spinning" : ""} />
            <span className="sr-only">Refresh scores</span>
          </button>
        </div>
      </section>

      <section className="board-content shell">
        {data.fundsRaisedCents !== undefined && (
          <div className="funds-raised">
            <strong>
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(data.fundsRaisedCents / 100)}
            </strong>
            <span>
              Event receipts · base receipts minus refunds, before event costs
              or charity transfers; excluding processing fees and taxes
            </span>
          </div>
        )}
        {error && (
          <p className="board-message error" role="status">
            {error}
          </p>
        )}

        {!leader && (
          <p className="board-empty">No teams have been added yet.</p>
        )}

        {remainingTeams.length > 0 && (
          <div className="full-standings">
            <div className="standings-heading">
              <div>
                <p className="eyebrow">
                  <span />
                  Verified scores
                </p>
                <h2>FULL STANDINGS</h2>
              </div>
              <span>Updates every 30 seconds while visible</span>
            </div>
            <div className="standings-table-labels">
              <span>Rank / Team</span>
              {visibleCategories.map((category) => (
                <span key={category}>{scoringConfig[category].shortLabel}</span>
              ))}
              <span>Total</span>
            </div>
            {remainingTeams.map((team, index) => (
              <article className="standing-row" key={team.id}>
                <div className="standing-team">
                  <span className="standing-rank">{index + 1}</span>
                  <span
                    className="standing-logo"
                    style={{ backgroundColor: team.accentColor }}
                  >
                    {teamInitials(team.displayName)}
                  </span>
                  <div>
                    <strong>{team.displayName}</strong>
                    <span>Updated {formatUpdatedAt(team.lastUpdated)}</span>
                  </div>
                </div>
                {visibleCategories.map((category) => (
                  <span
                    data-label={scoringConfig[category].shortLabel}
                    key={category}
                  >
                    {team[category]}
                  </span>
                ))}
                <strong className="standing-total" data-label="Total">
                  {team.totalPoints}
                </strong>
                <div
                  className="standing-progress"
                  style={{
                    width: `${Math.max((team.totalPoints / maxTotal) * 100, 2)}%`,
                    backgroundColor: team.accentColor,
                  }}
                />
              </article>
            ))}
          </div>
        )}

        <div className="scoring-key">
          <div>
            <p className="eyebrow">
              <span />
              How it adds up
            </p>
            <h2>SCORING KEY</h2>
          </div>
          <div className="scoring-key-grid">
            {visibleCategories.map((category, index) => (
              <div key={category}>
                <span>0{index + 1}</span>
                <strong>{scoringConfig[category].label}</strong>
                <p>{scoringConfig[category].description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="board-footer">
        <div className="shell">
          <span>KSigdillas · Kappa Sigma Theta-Omega</span>
          <a href={ticketUrl}>View ticket details →</a>
        </div>
      </footer>
    </main>
  );
}
