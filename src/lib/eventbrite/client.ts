import "server-only";

const eventbriteApiBaseUrl = "https://www.eventbriteapi.com/v3";
const maximumPages = 200;

type EventbriteAnswer = {
  answer?: unknown;
  question?: unknown;
};

export type EventbriteAttendee = {
  cancelled?: boolean;
  refunded?: boolean;
  status?: string;
  ticket_class_name?: string;
  answers?: EventbriteAnswer[];
};

type EventbriteAttendeesPage = {
  attendees?: EventbriteAttendee[];
  pagination?: {
    has_more_items?: boolean;
    page_number?: number;
    page_count?: number;
  };
  error_description?: string;
};

export class EventbriteApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventbriteApiError";
  }
}

export async function fetchEventbriteAttendees({
  eventId,
  privateToken,
}: {
  eventId: string;
  privateToken: string;
}) {
  const attendees: EventbriteAttendee[] = [];

  for (let page = 1; page <= maximumPages; page += 1) {
    const url = new URL(
      `${eventbriteApiBaseUrl}/events/${encodeURIComponent(eventId)}/attendees/`,
    );
    url.searchParams.set("page", String(page));

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${privateToken}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    const body = (await response.json().catch(() => null)) as
      | EventbriteAttendeesPage
      | null;

    if (!response.ok) {
      throw new EventbriteApiError(
        body?.error_description ||
          `Eventbrite attendee request failed with status ${response.status}.`,
      );
    }

    attendees.push(...(body?.attendees ?? []));

    if (!body?.pagination?.has_more_items) {
      return attendees;
    }
  }

  throw new EventbriteApiError(
    "Eventbrite returned more attendee pages than the configured safety limit.",
  );
}
