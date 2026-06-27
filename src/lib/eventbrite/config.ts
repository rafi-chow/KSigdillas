import "server-only";

import type { EventbriteSyncConfigStatus } from "@/types/eventbrite";

const defaultMinSeconds = 60;
const minimumAllowedSeconds = 15;
const maximumAllowedSeconds = 3_600;

function parseMinSeconds(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return defaultMinSeconds;
  return Math.min(
    Math.max(parsed, minimumAllowedSeconds),
    maximumAllowedSeconds,
  );
}

export function getEventbriteConfig() {
  const enabled = process.env.EVENTBRITE_SYNC_ENABLED === "true";
  const eventId = process.env.EVENTBRITE_EVENT_ID?.trim() || null;
  const privateToken = process.env.EVENTBRITE_PRIVATE_TOKEN?.trim() || null;
  const question = process.env.EVENTBRITE_TEAM_QUESTION?.trim() || null;
  const minSeconds = parseMinSeconds(
    process.env.EVENTBRITE_SYNC_MIN_SECONDS,
  );
  const missingVariables = [
    !eventId && "EVENTBRITE_EVENT_ID",
    !privateToken && "EVENTBRITE_PRIVATE_TOKEN",
    !question && "EVENTBRITE_TEAM_QUESTION",
  ].filter((value): value is string => Boolean(value));

  return {
    enabled,
    eventId,
    privateToken,
    question,
    minSeconds,
    missingVariables,
  };
}

export function getEventbriteConfigStatus(): EventbriteSyncConfigStatus {
  const config = getEventbriteConfig();
  return {
    enabled: config.enabled,
    configured: config.enabled && config.missingVariables.length === 0,
    eventId: config.eventId,
    question: config.question,
    minSeconds: config.minSeconds,
    missingVariables: config.missingVariables,
  };
}
