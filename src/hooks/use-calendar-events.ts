"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarEvent } from "@/lib/types";

export function useCalendarEvents(start: string, end: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
      if (res.ok) {
        const { events: data } = await res.json();
        setEvents(data ?? []);
      }
    } catch {
      // Calendar not connected — use empty events
    }
    setLoading(false);
  }, [start, end]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}
