/**
 * Simple global prefetch cache for calendar events.
 *
 * The app layout calls prefetchCalendarEvents() on mount so the data
 * is already in-flight (or resolved) by the time the schedule page renders.
 */
import type { CalendarEvent } from "./types";
import * as api from "./api";

let cache: {
  key: string;
  promise: Promise<CalendarEvent[]>;
  data: CalendarEvent[] | null;
  ts: number;
} | null = null;

const MAX_AGE_MS = 60_000; // 1 minute

function cacheKey(start: string, end: string) {
  return `${start}_${end}`;
}

export function prefetchCalendarEvents(start: string, end: string) {
  const key = cacheKey(start, end);
  if (cache?.key === key && Date.now() - cache.ts < MAX_AGE_MS) return;

  const promise = api.getCalendarEvents(start, end).then((data) => {
    if (cache?.key === key) cache.data = data;
    return data;
  });

  cache = { key, promise, data: null, ts: Date.now() };
}

export function getCachedCalendarEvents(
  start: string,
  end: string
): { promise: Promise<CalendarEvent[]>; data: CalendarEvent[] | null } | null {
  const key = cacheKey(start, end);
  if (cache?.key === key && Date.now() - cache.ts < MAX_AGE_MS) {
    return { promise: cache.promise, data: cache.data };
  }
  return null;
}

export function invalidateCalendarCache() {
  cache = null;
}
