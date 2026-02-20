"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Task } from "@/lib/types";
import { formatMinutes, todayString } from "@/lib/utils";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { TaskPosition } from "@/components/schedule/day-timeline";

interface ScheduleButtonProps {
  date: string;
  tasks: Task[];
  taskPositions: TaskPosition[];
  onEventCreated: (taskId: string, eventId: string) => void;
}

function minutesToISO(date: string, totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const h = hours.toString().padStart(2, "0");
  const m = mins.toString().padStart(2, "0");
  const dt = new Date(`${date}T${h}:${m}:00`);
  return dt.toISOString();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function ScheduleButton({
  date,
  tasks,
  taskPositions,
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
  const isToday = date === todayString();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (unscheduledTasks.length === 0) return null;
  if (isPast) return null;

  const totalMinutes = unscheduledTasks.reduce(
    (sum, t) => sum + (t.estimated_minutes ?? 0),
    0
  );

  async function handleSchedule() {
    setScheduling(true);

    try {
      let scheduled = 0;
      let skipped = 0;

      for (const task of unscheduledTasks) {
        const position = taskPositions.find((p) => p.taskId === task.id);
        if (!position) {
          skipped++;
          continue;
        }

        const startISO = minutesToISO(date, position.startMin);
        const endISO = minutesToISO(date, position.endMin);

        try {
          const result = await api.createCalendarEvent({
            summary: task.name,
            description: task.description ?? undefined,
            startDateTime: startISO,
            endDateTime: endISO,
            taskId: task.id,
          });

          onEventCreated(task.id, result.eventId);
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
          `${skipped} task${skipped > 1 ? "s" : ""} couldn't be scheduled`
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
