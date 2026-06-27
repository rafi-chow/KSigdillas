"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  LogOut,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { scoringConfig } from "@/lib/scoringConfig";
import {
  scoreCategories,
  type LeaderboardResponse,
  type ScoreCategory,
  type Team,
  type TeamInput,
} from "@/types/leaderboard";

type Notice = { type: "success" | "error"; text: string } | null;

const blankTeam: TeamInput = {
  name: "",
  displayName: "",
  accentColor: "#B5232B",
};

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(body.error || "Request failed.");
  }
  return body;
}

export function AdminLeaderboard() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [teamForm, setTeamForm] = useState<TeamInput>(blankTeam);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<Notice>(null);

  const loadTeams = useCallback(async () => {
    const data = await apiRequest<LeaderboardResponse>("/api/leaderboard");
    setTeams(data.teams);
  }, []);

  useEffect(() => {
    void apiRequest<{ authenticated: boolean; configured: boolean }>(
      "/api/admin/auth",
    )
      .then((result) => {
        setAuthenticated(result.authenticated);
        setConfigured(result.configured);
        if (result.authenticated) return loadTeams();
      })
      .catch(() => setNotice({ type: "error", text: "Could not check admin access." }))
      .finally(() => setAuthLoading(false));
  }, [loadTeams]);

  const sortedTeams = useMemo(
    () =>
      [...teams].sort(
        (a, b) =>
          b.totalPoints - a.totalPoints ||
          a.displayName.localeCompare(b.displayName),
      ),
    [teams],
  );

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy("login");
    setNotice(null);
    try {
      await apiRequest("/api/admin/auth", {
        method: "POST",
        body: JSON.stringify({ passcode }),
      });
      setPasscode("");
      setAuthenticated(true);
      await loadTeams();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to sign in.",
      });
    } finally {
      setBusy("");
    }
  }

  async function logout() {
    await apiRequest("/api/admin/auth", { method: "DELETE" });
    setAuthenticated(false);
    setTeams([]);
    setNotice(null);
  }

  async function updateScore(
    team: Team,
    category: ScoreCategory,
    direction: 1 | -1,
  ) {
    const key = `${team.id}:${category}`;
    const amount = Number.parseInt(deltas[key] || "0", 10);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setNotice({ type: "error", text: "Enter a positive whole-number point amount." });
      return;
    }

    setBusy(key);
    setNotice(null);
    try {
      const result = await apiRequest<{ team: Team; message: string }>(
        "/api/admin/leaderboard/scores",
        {
          method: "POST",
          body: JSON.stringify({
            teamId: team.id,
            category,
            amount: amount * direction,
          }),
        },
      );
      setTeams((current) =>
        current.map((item) => (item.id === result.team.id ? result.team : item)),
      );
      setDeltas((current) => ({ ...current, [key]: "" }));
      setNotice({
        type: "success",
        text: `${result.message} ${team.displayName} is now at ${result.team.totalPoints} total points.`,
      });
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to update score.",
      });
    } finally {
      setBusy("");
    }
  }

  function beginEdit(team: Team) {
    setEditingId(team.id);
    setTeamForm({
      name: team.name,
      displayName: team.displayName,
      accentColor: team.accentColor,
    });
    document.querySelector("#team-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setTeamForm(blankTeam);
  }

  async function saveTeam(event: FormEvent) {
    event.preventDefault();
    setBusy("team");
    setNotice(null);
    try {
      const result = await apiRequest<{ team: Team; message: string }>(
        "/api/admin/leaderboard/teams",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({
            ...teamForm,
            ...(editingId ? { id: editingId } : {}),
          }),
        },
      );
      setTeams((current) =>
        editingId
          ? current.map((team) => (team.id === result.team.id ? result.team : team))
          : [...current, result.team],
      );
      setNotice({ type: "success", text: result.message });
      cancelEdit();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to save team.",
      });
    } finally {
      setBusy("");
    }
  }

  async function resetDemoData() {
    if (
      !window.confirm(
        "Reset every score and team to the original demo data? This cannot be undone.",
      )
    ) {
      return;
    }

    setBusy("reset");
    setNotice(null);
    try {
      const result = await apiRequest<{ teams: Team[]; message: string }>(
        "/api/admin/leaderboard/reset",
        { method: "POST", body: "{}" },
      );
      setTeams(result.teams);
      setNotice({ type: "success", text: result.message });
      cancelEdit();
    } catch (error) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to reset data.",
      });
    } finally {
      setBusy("");
    }
  }

  if (authLoading) {
    return (
      <main className="admin-page admin-loading">
        <RefreshCw className="is-spinning" />
        <p>Checking admin access…</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-page admin-login-page">
        <Link className="admin-home-link" href="/">
          <ArrowLeft size={16} /> Back to event
        </Link>
        <section className="admin-login-card">
          <span className="admin-shield"><ShieldCheck /></span>
          <p className="eyebrow"><span />Scorekeeper access</p>
          <h1>ADMIN<br /><em>LEADERBOARD.</em></h1>
          <p>
            Enter the server-configured passcode to update competition scores.
            No public account is required.
          </p>
          {!configured ? (
            <div className="admin-not-configured">
              <TriangleAlert />
              <span>
                Admin access is disabled. Add <code>ADMIN_PASSCODE</code> to the
                server environment and restart the app.
              </span>
            </div>
          ) : (
            <form onSubmit={handleLogin}>
              <label htmlFor="admin-passcode">Admin passcode</label>
              <input
                id="admin-passcode"
                type="password"
                autoComplete="current-password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                minLength={4}
                required
              />
              <button className="button button-dark" disabled={busy === "login"}>
                {busy === "login" ? "Checking…" : "Open score desk"}
              </button>
            </form>
          )}
          {notice && (
            <div className={`admin-notice ${notice.type}`} role="alert">
              {notice.type === "error" ? <TriangleAlert /> : <CheckCircle2 />}
              {notice.text}
            </div>
          )}
          <small>The passcode is sent only to the server and is never bundled into this page.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div className="shell">
          <div>
            <span className="brand-mark">KΣ</span>
            <span><strong>KSigdillas Score Desk</strong><small>Admin controls</small></span>
          </div>
          <div>
            <a href="/leaderboard">View public board</a>
            <button type="button" onClick={logout}><LogOut /> Log out</button>
          </div>
        </div>
      </header>

      <div className="admin-content shell">
        <div className="admin-title-row">
          <div>
            <p className="eyebrow"><span />Live competition controls</p>
            <h1>UPDATE <em>SCORES.</em></h1>
            <p>Changes publish to the public leaderboard immediately.</p>
          </div>
          <button
            type="button"
            className="admin-reset"
            onClick={resetDemoData}
            disabled={busy === "reset"}
          >
            <RefreshCw className={busy === "reset" ? "is-spinning" : ""} />
            Reset demo data
          </button>
        </div>

        {notice && (
          <div className={`admin-notice sticky-notice ${notice.type}`} role="status">
            {notice.type === "error" ? <TriangleAlert /> : <CheckCircle2 />}
            {notice.text}
            <button type="button" onClick={() => setNotice(null)}>×</button>
          </div>
        )}

        <section className="admin-score-section">
          <div className="admin-section-heading">
            <span>01</span>
            <div><h2>POINT CONTROLS</h2><p>Add or subtract a whole-number amount by category.</p></div>
          </div>

          <div className="admin-team-list">
            {sortedTeams.map((team, rank) => (
              <article className="admin-team-card" key={team.id}>
                <div className="admin-team-name">
                  <span className="admin-rank">#{rank + 1}</span>
                  <span
                    className="admin-team-color"
                    style={{ backgroundColor: team.accentColor }}
                  />
                  <div><strong>{team.displayName}</strong><small>{team.totalPoints} total points</small></div>
                  <button type="button" onClick={() => beginEdit(team)}>
                    <Pencil /> Edit team
                  </button>
                </div>
                <div className="admin-categories">
                  {scoreCategories.map((category) => {
                    const key = `${team.id}:${category}`;
                    return (
                      <div className="admin-category" key={category}>
                        <div>
                          <span>{scoringConfig[category].shortLabel}</span>
                          <strong>{team[category]}</strong>
                        </div>
                        <div className="score-adjuster">
                          <button
                            type="button"
                            className="subtract"
                            aria-label={`Subtract ${scoringConfig[category].label} points from ${team.displayName}`}
                            disabled={busy === key}
                            onClick={() => updateScore(team, category, -1)}
                          >
                            <Minus />
                          </button>
                          <input
                            inputMode="numeric"
                            type="number"
                            min="1"
                            step="1"
                            placeholder="Pts"
                            aria-label={`${scoringConfig[category].label} point amount for ${team.displayName}`}
                            value={deltas[key] ?? ""}
                            onChange={(event) =>
                              setDeltas((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="add"
                            aria-label={`Add ${scoringConfig[category].label} points to ${team.displayName}`}
                            disabled={busy === key}
                            onClick={() => updateScore(team, category, 1)}
                          >
                            <Plus />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-team-editor" id="team-editor">
          <div className="admin-section-heading">
            <span>02</span>
            <div>
              <h2>{editingId ? "EDIT TEAM" : "ADD A TEAM"}</h2>
              <p>{editingId ? "Update the public team name and accent." : "New teams begin with zero points."}</p>
            </div>
          </div>
          <form onSubmit={saveTeam}>
            <label>
              Internal name
              <input
                value={teamForm.name}
                onChange={(event) =>
                  setTeamForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="alpha-chi-omega"
                maxLength={80}
                required
              />
            </label>
            <label>
              Display name
              <input
                value={teamForm.displayName}
                onChange={(event) =>
                  setTeamForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Alpha Chi Omega"
                maxLength={80}
                required
              />
            </label>
            <label className="color-field">
              Accent color
              <span>
                <input
                  type="color"
                  value={teamForm.accentColor}
                  onChange={(event) =>
                    setTeamForm((current) => ({
                      ...current,
                      accentColor: event.target.value,
                    }))
                  }
                />
                <input
                  value={teamForm.accentColor}
                  onChange={(event) =>
                    setTeamForm((current) => ({
                      ...current,
                      accentColor: event.target.value,
                    }))
                  }
                  pattern="^#[0-9a-fA-F]{6}$"
                  maxLength={7}
                  required
                />
              </span>
            </label>
            <div className="team-form-actions">
              {editingId && (
                <button type="button" onClick={cancelEdit}>Cancel</button>
              )}
              <button className="button button-dark" disabled={busy === "team"}>
                <Save /> {busy === "team" ? "Saving…" : editingId ? "Save changes" : "Create team"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
