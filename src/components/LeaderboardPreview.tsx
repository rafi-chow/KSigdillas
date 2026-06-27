"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
import type { LeaderboardResponse, Team } from "@/types/leaderboard";

const refreshInterval = 30_000;

function teamInitials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function LeaderboardPreview() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/leaderboard", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as LeaderboardResponse;
      setTeams(data.teams.slice(0, 3));
      setLastUpdated(data.lastUpdated);
    } catch {
      // Keep the last successful snapshot visible during a transient failure.
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, refreshInterval);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const max = teams[0]?.totalPoints || 1;

  return (
    <section className="leaderboard-section section" id="leaderboard">
      <div className="shell">
        <div className="section-heading section-heading-light">
          <p className="eyebrow light"><span />Live competition</p>
          <h2>CHASE THE <em>CROWN.</em></h2>
          <p>Every serve, bite, and show of support moves your chapter up the board.</p>
        </div>

        <div className="leaderboard-card">
          <div className="leaderboard-head">
            <div>
              <span className="live-dot" /> Live standings
            </div>
            <p>
              {lastUpdated
                ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : "Loading live scores…"}
            </p>
          </div>
          <div className="leaderboard-labels">
            <span>Rank / Chapter</span>
            <span>Volleyball</span>
            <span>Eating</span>
            <span>Support</span>
            <span>Total</span>
          </div>
          {teams.length === 0 ? (
            <div className="leaderboard-loading">Fetching the latest standings…</div>
          ) : teams.map((team, index) => (
            <article className="leaderboard-row" key={team.id}>
              <div className="team-cell">
                <span className={`rank rank-${index + 1}`}>
                  {index === 0 ? <Trophy size={18} /> : index + 1}
                </span>
                <span
                  className="chapter-mark"
                  style={{ backgroundColor: team.accentColor }}
                >
                  {teamInitials(team.displayName)}
                </span>
                <span><strong>{team.displayName}</strong><small>Chapter representatives</small></span>
              </div>
              <span data-label="Volleyball">{team.volleyballPoints}</span>
              <span data-label="Eating">{team.eatingCompetitionPoints}</span>
              <span data-label="Support">
                {team.ticketPoints + team.donationPoints + team.bonusPoints}
              </span>
              <strong className="total" data-label="Total">{team.totalPoints}</strong>
              <div className="score-bar" style={{ width: `${(team.totalPoints / max) * 100}%` }} />
            </article>
          ))}
          <div className="leaderboard-foot">
            <span>Scores refresh automatically every 30 seconds.</span>
            <a href="/leaderboard">
              View full leaderboard <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
