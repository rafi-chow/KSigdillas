"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  RefreshCw,
  Ticket,
  Trophy,
} from "lucide-react";
import { scoringConfig } from "@/lib/scoringConfig";
import {
  scoreCategories,
  type LeaderboardResponse,
} from "@/types/leaderboard";

const refreshInterval = 30_000;

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData((await response.json()) as LeaderboardResponse);
      setError("");
    } catch {
      setError("Could not refresh right now. Showing the last available scores.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, refreshInterval);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const [leader, ...remainingTeams] = data.teams;
  const maxTotal = leader?.totalPoints || 1;

  return (
    <main className="public-board-page">
      <header className="board-nav shell">
        <Link href="/" className="brand">
          <span className="brand-mark">KΣ</span>
          <span>KSIGDILLAS</span>
        </Link>
        <div className="board-nav-actions">
          <Link href="/" className="board-back"><ArrowLeft size={16} /> Event home</Link>
          <a href={ticketUrl} className="button button-cheese">
            Get Tickets <Ticket size={17} />
          </a>
        </div>
      </header>

      <section className="board-hero shell">
        <div>
          <p className="eyebrow light"><span />Live chapter competition</p>
          <h1>THE <em>LEADERBOARD.</em></h1>
          <p>Every ticket, serve, bite, and donation counts. Who takes the trophy?</p>
        </div>
        <div className="board-status">
          <span className="live-dot" />
          <div>
            <strong>Live standings</strong>
            <span><Clock3 size={13} /> Updated {formatUpdatedAt(data.lastUpdated)}</span>
          </div>
          <button type="button" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "is-spinning" : ""} />
            <span className="sr-only">Refresh scores</span>
          </button>
        </div>
      </section>

      <section className="board-content shell">
        {error && <p className="board-message error" role="status">{error}</p>}

        {leader ? (
          <article className="leader-spotlight">
            <div className="leader-rank">
              <Trophy />
              <span>Currently #1</span>
            </div>
            <div
              className="leader-logo"
              style={{ backgroundColor: leader.accentColor }}
            >
              {teamInitials(leader.displayName)}
            </div>
            <div className="leader-name">
              <p>Chapter to beat</p>
              <h2>{leader.displayName}</h2>
              <span>Last score activity: {formatUpdatedAt(leader.lastUpdated)}</span>
            </div>
            <div className="leader-total">
              <strong>{leader.totalPoints}</strong>
              <span>Total points</span>
            </div>
            <div className="leader-breakdown">
              {scoreCategories.map((category) => (
                <div key={category}>
                  <span>{scoringConfig[category].shortLabel}</span>
                  <strong>{leader[category]}</strong>
                </div>
              ))}
            </div>
          </article>
        ) : (
          <div className="board-empty">No teams have been added yet.</div>
        )}

        {remainingTeams.length > 0 && (
          <div className="full-standings">
            <div className="standings-heading">
              <div>
                <p className="eyebrow"><span />The chase</p>
                <h2>FULL STANDINGS</h2>
              </div>
              <span>Auto-refreshes every 30 seconds</span>
            </div>
            <div className="standings-table-labels">
              <span>Rank / Team</span>
              {scoreCategories.map((category) => (
                <span key={category}>{scoringConfig[category].shortLabel}</span>
              ))}
              <span>Total</span>
            </div>
            {remainingTeams.map((team, index) => (
              <article className="standing-row" key={team.id}>
                <div className="standing-team">
                  <span className="standing-rank">{index + 2}</span>
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
                {scoreCategories.map((category) => (
                  <span data-label={scoringConfig[category].shortLabel} key={category}>
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
            <p className="eyebrow"><span />How it adds up</p>
            <h2>SCORING KEY</h2>
          </div>
          <div className="scoring-key-grid">
            {scoreCategories.map((category, index) => (
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
          <a href={ticketUrl}>Support your chapter →</a>
        </div>
      </footer>
    </main>
  );
}
