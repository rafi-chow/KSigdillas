import { Trophy } from "lucide-react";
import { leaderboardData } from "@/lib/eventConfig";

export function LeaderboardPreview() {
  const max = leaderboardData[0].total;

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
              <span className="live-dot" /> Preview standings
            </div>
            <p>Sample data · Live updates coming soon</p>
          </div>
          <div className="leaderboard-labels">
            <span>Rank / Chapter</span>
            <span>Volleyball</span>
            <span>Eating</span>
            <span>Support</span>
            <span>Total</span>
          </div>
          {leaderboardData.map((team) => (
            <article className="leaderboard-row" key={team.chapter}>
              <div className="team-cell">
                <span className={`rank rank-${team.rank}`}>
                  {team.rank === 1 ? <Trophy size={18} /> : team.rank}
                </span>
                <span className="chapter-mark">{team.initials}</span>
                <span><strong>{team.chapter}</strong><small>Chapter representatives</small></span>
              </div>
              <span data-label="Volleyball">{team.volleyball}</span>
              <span data-label="Eating">{team.eating}</span>
              <span data-label="Support">{team.support}</span>
              <strong className="total" data-label="Total">{team.total}</strong>
              <div className="score-bar" style={{ width: `${(team.total / max) * 100}%` }} />
            </article>
          ))}
          <div className="leaderboard-foot">
            <span>Points are illustrative until competition scoring is finalized.</span>
            <strong>Trophy + eternal bragging rights await.</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
