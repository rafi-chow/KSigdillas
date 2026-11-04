"use client";
import { useEffect, useState } from "react";
import type { LaunchCheck } from "@/lib/launch";
export function LaunchStatus() {
  const [checks, setChecks] = useState<LaunchCheck[] | null>(null);
  const [message, setMessage] = useState("Loading launch checks…");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/operations/launch", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "Sign in with an organizer account to view launch status.",
          );
        const data = await r.json();
        setChecks(data.checks);
        setMessage("");
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setMessage(
            e instanceof Error ? e.message : "Unable to load launch status.",
          );
      });
    return () => controller.abort();
  }, []);
  return (
    <>
      {message && <p role="status">{message}</p>}
      {checks && (
        <>
          <p role="status">
            {checks.filter((c) => c.ready).length} of {checks.length} launch
            checks recorded.
          </p>
          <ul className="launch-checks">
            {checks.map((c) => (
              <li key={c.id}>
                <strong>{c.ready ? "Recorded" : "Pending"}:</strong> {c.label}
              </li>
            ))}
          </ul>
        </>
      )}
      <p>
        These checks summarize reviewed evidence, not legal certification.
        Stripe configuration and live payment acceptance remain separately
        required. Sales stay closed until the required checks are recorded.
      </p>
    </>
  );
}
