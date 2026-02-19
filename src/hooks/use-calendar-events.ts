"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarEvent } from "@/lib/types";

export function useCalendarEvents(start: string, end: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
      if (res.ok) {
        const { events: data } = await res.json();
        setEvents(data ?? []);
      } else {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? `Calendar fetch failed (${res.status})`;
        setError(msg);
        console.error("Calendar events fetch error:", msg);
      }
    } catch (err) {
      setError("Failed to connect to calendar");
      console.error("Calendar events fetch exception:", err);
    }
    setLoading(false);
  }, [start, end]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}
