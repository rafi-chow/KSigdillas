import "server-only";

import {
  EventbriteApiError,
  fetchEventbriteAttendees,
  type EventbriteAttendee,
} from "@/lib/eventbrite/client";
import {
  getEventbriteConfig,
  getEventbriteConfigStatus,
} from "@/lib/eventbrite/config";
import {
  findTeamForAnswer,
  getTicketTierPoints,
  normalizeEventbriteValue,
} from "@/lib/eventbrite/mapping";
import { leaderboardRepository } from "@/lib/leaderboard";
import type {
  EventbriteSyncReport,
  EventbriteSyncStatus,
} from "@/types/eventbrite";

type SyncRuntime = {
  lastSync: EventbriteSyncReport | null;
  activeSync: Promise<EventbriteSyncReport> | null;
};

const globalRuntime = globalThis as typeof globalThis & {
  eventbriteSyncRuntime?: SyncRuntime;
};

const runtime =
  globalRuntime.eventbriteSyncRuntime ??
  ({
    lastSync: null,
    activeSync: null,
  } satisfies SyncRuntime);

globalRuntime.eventbriteSyncRuntime = runtime;

function attendeeShouldBeSkipped(attendee: EventbriteAttendee) {
  const status = attendee.status?.toLowerCase() ?? "";
  return Boolean(
    attendee.cancelled ||
      attendee.refunded ||
      status.includes("cancel") ||
      status.includes("refund") ||
      status.includes("delete"),
  );
}

function getTeamAnswer(
  attendee: EventbriteAttendee,
  configuredQuestion: string,
) {
  const normalizedQuestion = normalizeEventbriteValue(configuredQuestion);
  const answer = attendee.answers?.find(
    (candidate) =>
      typeof candidate.question === "string" &&
      normalizeEventbriteValue(candidate.question) === normalizedQuestion,
  )?.answer;

  return typeof answer === "string" ? answer.trim() : null;
}

function incrementCount(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function toCountEntries(counts: Map<string, number>) {
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export async function fetchEventbriteTicketSnapshot() {
  const config = getEventbriteConfig();
  if (!config.enabled) {
    throw new EventbriteApiError(
      "Eventbrite sync is disabled. Set EVENTBRITE_SYNC_ENABLED=true and configure EVENTBRITE_PRIVATE_TOKEN.",
    );
  }
  if (
    config.missingVariables.length > 0 ||
    !config.eventId ||
    !config.privateToken ||
    !config.question
  ) {
    throw new EventbriteApiError(
      `Eventbrite sync is missing: ${config.missingVariables.join(", ")}.`,
    );
  }

  const [teams, attendees] = await Promise.all([
    leaderboardRepository.getTeams(),
    fetchEventbriteAttendees({
      eventId: config.eventId,
      privateToken: config.privateToken,
    }),
  ]);
  const teamPoints = Object.fromEntries(teams.map((team) => [team.id, 0]));
  const unmatchedTeamAnswers = new Map<string, number>();
  const unmatchedTicketTiers = new Map<string, number>();
  let ticketsCounted = 0;
  let skippedAttendees = 0;
  let pointsAwarded = 0;

  for (const attendee of attendees) {
    if (attendeeShouldBeSkipped(attendee)) {
      skippedAttendees += 1;
      continue;
    }

    const ticketTier = attendee.ticket_class_name?.trim();
    const ticketPoints = ticketTier ? getTicketTierPoints(ticketTier) : null;
    if (ticketPoints === null) {
      incrementCount(
        unmatchedTicketTiers,
        ticketTier || "Missing ticket tier",
      );
      skippedAttendees += 1;
      continue;
    }

    const answer = getTeamAnswer(attendee, config.question);
    const team = answer ? findTeamForAnswer(teams, answer) : null;
    if (!team) {
      incrementCount(
        unmatchedTeamAnswers,
        answer || "Missing team answer",
      );
      skippedAttendees += 1;
      continue;
    }

    teamPoints[team.id] += ticketPoints;
    ticketsCounted += 1;
    pointsAwarded += ticketPoints;
  }

  const report: EventbriteSyncReport = {
    syncedAt: new Date().toISOString(),
    eventId: config.eventId,
    attendeesProcessed: attendees.length,
    ticketsCounted,
    pointsAwarded,
    skippedAttendees,
    unmatchedTeamAnswers: toCountEntries(unmatchedTeamAnswers).map(
      ({ value, count }) => ({ answer: value, count }),
    ),
    unmatchedTicketTiers: toCountEntries(unmatchedTicketTiers).map(
      ({ value, count }) => ({ ticketTier: value, count }),
    ),
    teamPoints,
  };
  return report;
}

async function performSync() {
  const report = await fetchEventbriteTicketSnapshot();
  await leaderboardRepository.replaceTicketPoints(report.teamPoints);
  runtime.lastSync = report;
  return report;
}

export function getEventbriteSyncStatus(): EventbriteSyncStatus {
  return {
    config: getEventbriteConfigStatus(),
    lastSync: runtime.lastSync,
  };
}

export async function syncEventbriteTickets() {
  const config = getEventbriteConfig();
  if (runtime.activeSync) return runtime.activeSync;

  if (runtime.lastSync) {
    const elapsedSeconds =
      (Date.now() - new Date(runtime.lastSync.syncedAt).getTime()) / 1_000;
    if (elapsedSeconds < config.minSeconds) {
      const retryAfter = Math.ceil(config.minSeconds - elapsedSeconds);
      throw new EventbriteApiError(
        `Eventbrite was synced recently. Try again in ${retryAfter} seconds.`,
      );
    }
  }

  runtime.activeSync = performSync().finally(() => {
    runtime.activeSync = null;
  });
  return runtime.activeSync;
}
