"use client";

import { useState, useEffect, useCallback } from "react";
import * as api from "@/lib/api";
import { CalendarEvent } from "@/lib/types";

export function useCalendarEvents(start: string, end: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCalendarEvents(start, end);
      setEvents(data ?? []);
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? "Failed to connect to calendar";
      setError(msg);
      console.error("Calendar events fetch error:", msg);
    }
    setLoading(false);
  }, [start, end]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}
