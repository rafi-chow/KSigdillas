export type EventbriteSyncReport = {
  syncedAt: string;
  eventId: string;
  attendeesProcessed: number;
  ticketsCounted: number;
  pointsAwarded: number;
  skippedAttendees: number;
  unmatchedTeamAnswers: Array<{
    answer: string;
    count: number;
  }>;
  unmatchedTicketTiers: Array<{
    ticketTier: string;
    count: number;
  }>;
  teamPoints: Record<string, number>;
};

export type EventbriteSyncConfigStatus = {
  enabled: boolean;
  configured: boolean;
  eventId: string | null;
  question: string | null;
  minSeconds: number;
  missingVariables: string[];
};

export type EventbriteSyncStatus = {
  config: EventbriteSyncConfigStatus;
  lastSync: EventbriteSyncReport | null;
};
