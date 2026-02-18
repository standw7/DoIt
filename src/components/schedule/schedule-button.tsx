"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarEvent, Task } from "@/lib/types";
import { formatMinutes, todayString } from "@/lib/utils";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseISO } from "date-fns";

interface ScheduleButtonProps {
  date: string;
  tasks: Task[];
  events: CalendarEvent[];
  workStart: string;
  workEnd: string;
  onEventCreated: (taskId: string, eventId: string) => void;
}

interface FreeSlot {
  startMin: number;
  endMin: number;
  durationMin: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function currentTimeMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function roundUpTo15(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

function minutesToISO(date: string, totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const h = hours.toString().padStart(2, "0");
  const m = mins.toString().padStart(2, "0");
  const dt = new Date(`${date}T${h}:${m}:00`);
  return dt.toISOString();
}

function getFreeSlots(
  events: CalendarEvent[],
  date: string,
  workStartMin: number,
  workEndMin: number
): FreeSlot[] {
  // If scheduling for today, start from current time (rounded up to next 15 min)
  const isToday = date === todayString();
  const effectiveStart = isToday
    ? Math.max(workStartMin, roundUpTo15(currentTimeMinutes()))
    : workStartMin;

  // If current time is past work end, no slots available
  if (effectiveStart >= workEndMin) return [];

  const busy: { start: number; end: number }[] = [];

  for (const event of events) {
    if (event.allDay) continue;
    if (!event.start.startsWith(date)) continue;

    const eventStart = parseISO(event.start);
    const eventEnd = parseISO(event.end);

    const startMin = eventStart.getHours() * 60 + eventStart.getMinutes();
    let endMin = eventEnd.getHours() * 60 + eventEnd.getMinutes();

    if (endMin <= startMin) {
      endMin = workEndMin;
    }

    busy.push({
      start: Math.max(startMin, effectiveStart),
      end: Math.min(endMin, workEndMin),
    });
  }

  busy.sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const interval of busy) {
    if (interval.start >= interval.end) continue;
    if (merged.length > 0 && interval.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        interval.end
      );
    } else {
      merged.push({ ...interval });
    }
  }

  const slots: FreeSlot[] = [];
  let cursor = effectiveStart;

  for (const interval of merged) {
    if (cursor < interval.start) {
      const duration = interval.start - cursor;
      if (duration >= 15) {
        slots.push({ startMin: cursor, endMin: interval.start, durationMin: duration });
      }
    }
    cursor = Math.max(cursor, interval.end);
  }

  if (cursor < workEndMin) {
    const duration = workEndMin - cursor;
    if (duration >= 15) {
      slots.push({ startMin: cursor, endMin: workEndMin, durationMin: duration });
    }
  }

  return slots;
}

export function ScheduleButton({
  date,
  tasks,
  events,
  workStart,
  workEnd,
  onEventCreated,
}: ScheduleButtonProps) {
  const [scheduling, setScheduling] = useState(false);

  const unscheduledTasks = tasks.filter(
    (t) =>
      t.status === "planned" &&
      !t.google_event_id &&
      t.estimated_minutes
  );

  // Check if this is a past date
  const isPast = date < todayString();
  // Check if today but past work hours
  const isToday = date === todayString();
  const workEndMin = timeToMinutes(workEnd);
  const pastWorkHours = isToday && currentTimeMinutes() >= workEndMin;

  if (unscheduledTasks.length === 0) return null;
  if (isPast || pastWorkHours) return null;

  const totalMinutes = unscheduledTasks.reduce(
    (sum, t) => sum + (t.estimated_minutes ?? 0),
    0
  );

  async function handleSchedule() {
    setScheduling(true);

    try {
      const workStartMin = timeToMinutes(workStart);
      const workEndMin = timeToMinutes(workEnd);

      const freeSlots = getFreeSlots(events, date, workStartMin, workEndMin);
      freeSlots.sort((a, b) => b.durationMin - a.durationMin);

      const sortedTasks = [...unscheduledTasks].sort(
        (a, b) => (b.estimated_minutes ?? 0) - (a.estimated_minutes ?? 0)
      );

      let scheduled = 0;
      let skipped = 0;

      const slotRemaining = freeSlots.map((s) => ({
        ...s,
        cursor: s.startMin,
      }));

      for (const task of sortedTasks) {
        const duration = task.estimated_minutes ?? 0;
        if (duration <= 0) continue;

        const slotIndex = slotRemaining.findIndex(
          (s) => s.endMin - s.cursor >= duration
        );

        if (slotIndex === -1) {
          skipped++;
          continue;
        }

        const slot = slotRemaining[slotIndex];
        const startISO = minutesToISO(date, slot.cursor);
        const endISO = minutesToISO(date, slot.cursor + duration);

        try {
          const res = await fetch("/api/calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: task.name,
              description: task.description ?? undefined,
              startDateTime: startISO,
              endDateTime: endISO,
              taskId: task.id,
            }),
          });

          if (!res.ok) {
            skipped++;
            continue;
          }

          const { eventId } = await res.json();
          onEventCreated(task.id, eventId);
          slot.cursor += duration;
          scheduled++;
        } catch {
          skipped++;
        }
      }

      if (scheduled > 0) {
        toast.success(
          `Scheduled ${scheduled} task${scheduled > 1 ? "s" : ""} to your calendar`
        );
      }
      if (skipped > 0) {
        toast.warning(
          `${skipped} task${skipped > 1 ? "s" : ""} couldn't fit into free time`
        );
      }
    } catch {
      toast.error("Failed to schedule tasks");
    } finally {
      setScheduling(false);
    }
  }

  return (
    <Button
      onClick={handleSchedule}
      disabled={scheduling}
      className="w-full"
      size="lg"
    >
      {scheduling ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CalendarPlus className="mr-2 h-4 w-4" />
      )}
      Schedule my day
      <span className="ml-2 text-xs opacity-80">
        ({unscheduledTasks.length} task{unscheduledTasks.length > 1 ? "s" : ""},{" "}
        {formatMinutes(totalMinutes)})
      </span>
    </Button>
  );
}
