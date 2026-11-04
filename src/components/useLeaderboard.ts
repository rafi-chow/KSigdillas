"use client";
import { useSyncExternalStore } from "react";
import type { LeaderboardResponse } from "@/types/leaderboard";

type Snapshot = {
  data: LeaderboardResponse | null;
  error: boolean;
  refreshing: boolean;
};
const empty: Snapshot = { data: null, error: false, refreshing: false };
let snapshot = empty;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Promise<void> | undefined;
let controller: AbortController | undefined;
let failures = 0;
const publish = (next: Snapshot) => {
  snapshot = next;
  listeners.forEach((fn) => fn());
};
function schedule() {
  clearTimeout(timer);
  if (listeners.size && !document.hidden)
    timer = setTimeout(
      () => void refreshLeaderboard(),
      Math.min(240000, 30000 * 2 ** failures),
    );
}
export function refreshLeaderboard() {
  if (pending) return pending;
  clearTimeout(timer);
  controller = new AbortController();
  publish({ ...snapshot, refreshing: true });
  pending = (async () => {
    try {
      const response = await fetch("/api/leaderboard", {
        signal: AbortSignal.any([
          controller!.signal,
          AbortSignal.timeout(10000),
        ]),
      });
      if (!response.ok) throw new Error("Scores unavailable");
      const data = (await response.json()) as LeaderboardResponse;
      failures = 0;
      publish({ data, error: false, refreshing: false });
    } catch {
      failures++;
      publish({ ...snapshot, error: true, refreshing: false });
    } finally {
      pending = undefined;
      schedule();
    }
  })();
  return pending;
}
function visibilityChanged() {
  clearTimeout(timer);
  if (!document.hidden) void refreshLeaderboard();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", visibilityChanged);
    // Defer the initial request so Strict Mode's mount check does not duplicate it.
    timer = setTimeout(() => {
      if (!document.hidden) void refreshLeaderboard();
    }, 0);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visibilityChanged);
    }
  };
}
export function useLeaderboard() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => empty,
  );
}
