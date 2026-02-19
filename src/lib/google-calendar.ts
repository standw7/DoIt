import { CalendarEvent } from "./types";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export async function getCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax + "T23:59:59").toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Calendar API error: ${res.status} ${error}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    summary: item.summary ?? "(No title)",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    allDay: !!item.start?.date && !item.start?.dateTime,
  }));
}

export async function listCalendars(
  accessToken: string
): Promise<{ id: string; summary: string }[]> {
  const res = await fetch(
    `${CALENDAR_API}/users/me/calendarList?minAccessRole=reader`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Calendar list API error: ${res.status}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    summary: item.summary ?? "(No title)",
  }));
}

export async function getAllCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const calendars = await listCalendars(accessToken);
  const seen = new Set<string>();
  const allEvents: CalendarEvent[] = [];

  // Fetch events from all calendars in parallel
  const results = await Promise.allSettled(
    calendars.map((cal) => getCalendarEvents(accessToken, cal.id, timeMin, timeMax))
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const event of result.value) {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        allEvents.push(event);
      }
    }
  }

  return allEvents;
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    taskId: string;
  }
): Promise<string> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startDateTime },
        end: { dateTime: event.endDateTime },
        extendedProperties: {
          private: { doitTaskId: event.taskId },
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
  const data = await res.json();
  return data.id;
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  update: { startDateTime: string; endDateTime: string }
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start: { dateTime: update.startDateTime },
        end: { dateTime: update.endDateTime },
      }),
    }
  );

  if (!res.ok) throw new Error(`Failed to update event: ${res.status}`);
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete event: ${res.status}`);
  }
}

export async function createDoItCalendar(accessToken: string): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: "DoIt Tasks",
      description: "Task blocks created by DoIt",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });

  if (!res.ok) throw new Error(`Failed to create calendar: ${res.status}`);
  const data = await res.json();
  return data.id;
}
