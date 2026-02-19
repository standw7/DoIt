"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CalendarEvent, Task } from "@/lib/types";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseISO } from "date-fns";

interface ConflictRescheduleProps {
  date: string;
  tasks: Task[];
  events: CalendarEvent[];
  workStart: string;
  workEnd: string;
  onRescheduled: () => void;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToISO(date: string, totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const h = hours.toString().padStart(2, "0");
  const m = mins.toString().padStart(2, "0");
  return new Date(`${date}T${h}:${m}:00`).toISOString();
}

interface Conflict {
  task: Task;
  taskEvent: CalendarEvent;
}

export function ConflictReschedule({
  date,
  tasks,
  events,
  workStart,
  workEnd,
  onRescheduled,
}: ConflictRescheduleProps) {
  const [rescheduling, setRescheduling] = useState(false);

  const conflicts = useMemo(() => {
    const workStartMin = timeToMinutes(workStart);
    const workEndMin = timeToMinutes(workEnd);

    // Build set of event IDs that belong to DoIt tasks
    const taskEventIds = new Set(
      tasks.filter((t) => t.google_event_id).map((t) => t.google_event_id!)
    );

    // Separate task events from external events
    const taskEvents: CalendarEvent[] = [];
    const externalEvents: CalendarEvent[] = [];
    for (const event of events) {
      if (event.allDay) continue;
      if (!event.start.startsWith(date)) continue;
      if (taskEventIds.has(event.id)) {
        taskEvents.push(event);
      } else {
        externalEvents.push(event);
      }
    }

    // Check for overlaps between task events and external events
    const result: Conflict[] = [];
    for (const taskEvent of taskEvents) {
      const teStart = parseISO(taskEvent.start);
      const teEnd = parseISO(taskEvent.end);
      const teStartMin = teStart.getHours() * 60 + teStart.getMinutes();
      let teEndMin = teEnd.getHours() * 60 + teEnd.getMinutes();
      if (teEndMin <= teStartMin) teEndMin = workEndMin;

      for (const ext of externalEvents) {
        const extStart = parseISO(ext.start);
        const extEnd = parseISO(ext.end);
        const extStartMin = extStart.getHours() * 60 + extStart.getMinutes();
        let extEndMin = extEnd.getHours() * 60 + extEnd.getMinutes();
        if (extEndMin <= extStartMin) extEndMin = workEndMin;

        // Overlap: one starts before the other ends
        if (teStartMin < extEndMin && extStartMin < teEndMin) {
          const task = tasks.find((t) => t.google_event_id === taskEvent.id);
          if (task) {
            result.push({ task, taskEvent });
            break; // Only need to detect one overlap per task
          }
        }
      }
    }

    return result;
  }, [tasks, events, date, workStart, workEnd]);

  if (conflicts.length === 0) return null;

  async function handleReschedule() {
    setRescheduling(true);
    const workStartMin = timeToMinutes(workStart);
    const workEndMin = timeToMinutes(workEnd);

    // Build set of task event IDs that are conflicting (we'll move these)
    const conflictEventIds = new Set(conflicts.map((c) => c.taskEvent.id));

    // Build busy intervals from ALL events EXCEPT the conflicting task events
    const busy: { start: number; end: number }[] = [];
    for (const event of events) {
      if (event.allDay) continue;
      if (!event.start.startsWith(date)) continue;
      if (conflictEventIds.has(event.id)) continue; // skip conflicting tasks, we're moving them

      const evStart = parseISO(event.start);
      const evEnd = parseISO(event.end);
      const startMin = evStart.getHours() * 60 + evStart.getMinutes();
      let endMin = evEnd.getHours() * 60 + evEnd.getMinutes();
      if (endMin <= startMin) endMin = workEndMin;
      busy.push({ start: startMin, end: endMin });
    }

    busy.sort((a, b) => a.start - b.start);

    // Merge overlapping busy intervals
    const merged: { start: number; end: number }[] = [];
    for (const interval of busy) {
      if (interval.start >= interval.end) continue;
      if (merged.length > 0 && interval.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, interval.end);
      } else {
        merged.push({ ...interval });
      }
    }

    // Find free slots
    const slots: { start: number; end: number; cursor: number }[] = [];
    let cursor = workStartMin;
    for (const interval of merged) {
      if (cursor < interval.start) {
        slots.push({ start: cursor, end: interval.start, cursor });
      }
      cursor = Math.max(cursor, interval.end);
    }
    if (cursor < workEndMin) {
      slots.push({ start: cursor, end: workEndMin, cursor });
    }

    let rescheduled = 0;
    let failed = 0;

    for (const { task, taskEvent } of conflicts) {
      const duration = task.estimated_minutes ?? 30;

      // Find a slot that fits this task
      let placed = false;
      for (const slot of slots) {
        const available = slot.end - slot.cursor;
        if (duration <= available) {
          const newStartISO = minutesToISO(date, slot.cursor);
          const newEndISO = minutesToISO(date, slot.cursor + duration);

          try {
            const res = await fetch(`/api/calendar/events/${taskEvent.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startDateTime: newStartISO,
                endDateTime: newEndISO,
              }),
            });

            if (res.ok) {
              slot.cursor += duration;
              rescheduled++;
              placed = true;
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
          break;
        }
      }

      if (!placed && failed === 0) {
        failed++;
        toast.warning(`"${task.name}" doesn't fit in the remaining free time`);
      }
    }

    if (rescheduled > 0) {
      toast.success(
        `Rescheduled ${rescheduled} task${rescheduled > 1 ? "s" : ""} around conflicts`
      );
      onRescheduled();
    }
    if (failed > 0 && rescheduled === 0) {
      toast.error("Couldn't reschedule — no free time available");
    }

    setRescheduling(false);
  }

  return (
    <div className="flex items-center gap-3 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {conflicts.length} scheduled task{conflicts.length > 1 ? "s" : ""} conflict{conflicts.length === 1 ? "s" : ""} with calendar events
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={handleReschedule}
        disabled={rescheduling}
        className="shrink-0"
      >
        {rescheduling ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : null}
        Reschedule
      </Button>
    </div>
  );
}
