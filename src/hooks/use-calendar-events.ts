"use client";

import { useState, useEffect, useCallback } from "react";
import * as api from "@/lib/api";
import { CalendarEvent } from "@/lib/types";
import { getCachedCalendarEvents, invalidateCalendarCache, prefetchCalendarEvents } from "@/lib/prefetch";

export function useCalendarEvents(start: string, end: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check prefetch cache first — if the layout already started this request,
      // reuse it instead of making a duplicate call
      const cached = getCachedCalendarEvents(start, end);
      let data: CalendarEvent[];
      if (cached?.data) {
        data = cached.data;
      } else if (cached?.promise) {
        data = await cached.promise;
      } else {
        data = await api.getCalendarEvents(start, end);
      }
      setEvents(data ?? []);
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? "Failed to connect to calendar";
      setError(msg);
      console.error("Calendar events fetch error:", msg);
    }
    setLoading(false);
  }, [start, end]);

  const refetch = useCallback(async () => {
    // Silent refetch — don't set loading to avoid page flash
    invalidateCalendarCache();
    try {
      const data = await api.getCalendarEvents(start, end);
      setEvents(data ?? []);
      // Re-warm the cache for future navigations
      prefetchCalendarEvents(start, end);
    } catch {
      // Silent — keep existing events on screen
    }
  }, [start, end]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const removeEvent = useCallback((eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  }, []);

  return { events, loading, error, refetch, removeEvent };
}
