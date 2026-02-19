"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarEvent, Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { Clock, CalendarDays, AlertCircle, CheckCircle2 } from "lucide-react";
import { parseISO, format } from "date-fns";

interface DayTimelineProps {
  date: string;
  events: CalendarEvent[];
  tasks: Task[];
  workStart: string;
  workEnd: string;
  isToday?: boolean;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function eventToTimeRange(
  event: CalendarEvent,
  date: string,
  workEndMin: number
): { startMin: number; endMin: number } | null {
  if (event.allDay) return null;
  if (!event.start.startsWith(date)) return null;

  const eventStart = parseISO(event.start);
  const eventEnd = parseISO(event.end);

  const startMin = eventStart.getHours() * 60 + eventStart.getMinutes();
  let endMin = eventEnd.getHours() * 60 + eventEnd.getMinutes();

  // Handle midnight-crossing events: clamp to end of working hours
  if (endMin <= startMin) {
    endMin = workEndMin;
  }

  return { startMin, endMin };
}

interface TimeBlock {
  type: "event" | "task";
  id: string;
  label: string;
  startMin: number;
  endMin: number;
  durationMinutes: number;
}

export function DayTimeline({
  date,
  events,
  tasks,
  workStart,
  workEnd,
  isToday = false,
}: DayTimelineProps) {
  const workStartMin = timeToMinutes(workStart);
  const workEndMin = timeToMinutes(workEnd);

  const hours = useMemo(() => {
    const startHour = Math.floor(workStartMin / 60);
    const endHour = Math.ceil(workEndMin / 60);
    const result: number[] = [];
    for (let h = startHour; h < endHour; h++) {
      result.push(h);
    }
    return result;
  }, [workStartMin, workEndMin]);

  const { blocks, overflowTasks } = useMemo(() => {
    // Build event blocks
    const eventBlocks: TimeBlock[] = [];
    for (const event of events) {
      const range = eventToTimeRange(event, date, workEndMin);
      if (!range) continue;
      eventBlocks.push({
        type: "event",
        id: event.id,
        label: event.summary,
        startMin: range.startMin,
        endMin: range.endMin,
        durationMinutes: range.endMin - range.startMin,
      });
    }

    // Collect unscheduled tasks to auto-stack
    const unscheduled = tasks.filter(
      (t) =>
        t.status === "planned" &&
        !t.google_event_id &&
        t.estimated_minutes
    );

    // Sort events by start time to find gaps
    const sorted = [...eventBlocks].sort((a, b) => a.startMin - b.startMin);

    // Build list of free gaps within working hours
    const gaps: { start: number; end: number }[] = [];
    let cursor = workStartMin;
    for (const block of sorted) {
      if (block.startMin > cursor) {
        gaps.push({ start: cursor, end: block.startMin });
      }
      cursor = Math.max(cursor, block.endMin);
    }
    if (cursor < workEndMin) {
      gaps.push({ start: cursor, end: workEndMin });
    }

    // Place tasks into gaps
    const taskBlocks: TimeBlock[] = [];
    const overflowTasks: Task[] = [];
    let gapIdx = 0;
    let gapCursor = gaps.length > 0 ? gaps[0].start : workEndMin;

    for (const task of unscheduled) {
      const dur = task.estimated_minutes!;
      let placed = false;

      while (gapIdx < gaps.length) {
        const gap = gaps[gapIdx];
        const available = gap.end - gapCursor;
        if (dur <= available) {
          taskBlocks.push({
            type: "task",
            id: task.id,
            label: task.name,
            startMin: gapCursor,
            endMin: gapCursor + dur,
            durationMinutes: dur,
          });
          gapCursor += dur;
          placed = true;
          break;
        }
        // Move to next gap
        gapIdx++;
        if (gapIdx < gaps.length) {
          gapCursor = gaps[gapIdx].start;
        }
      }

      if (!placed) {
        overflowTasks.push(task);
      }
    }

    const allBlocks = [...eventBlocks, ...taskBlocks].sort(
      (a, b) => a.startMin - b.startMin
    );

    return { blocks: allBlocks, overflowTasks };
  }, [events, tasks, date, workStartMin, workEndMin]);

  const hasContent = blocks.length > 0 || overflowTasks.length > 0;

  if (!hasContent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <CalendarDays className="mb-3 h-8 w-8" />
          <p className="text-sm">No events or tasks for this day</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex items-start border-t border-border/50"
                style={{ minHeight: "3rem" }}
              >
                <span className="w-16 shrink-0 pr-3 pt-1 text-right text-xs text-muted-foreground">
                  {format(new Date(2000, 0, 1, hour), "h a")}
                </span>
                <div className="relative flex-1 min-h-12">
                  {blocks
                    .filter((b) => Math.floor(b.startMin / 60) === hour)
                    .map((block) => {
                      const heightRatio = Math.min(
                        block.durationMinutes / 60,
                        4
                      );
                      return (
                        <div
                          key={block.id}
                          className={cn(
                            "mb-1 rounded-md px-3 py-1.5 text-xs",
                            block.type === "event"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                              : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                          )}
                          style={{
                            minHeight: `${Math.max(heightRatio * 3, 1.75)}rem`,
                          }}
                        >
                          <div className="font-medium">{block.label}</div>
                          <div className="opacity-70">
                            {formatMinutes(block.durationMinutes)}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isToday && (() => {
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        return nowMin >= workEndMin + 30;
      })() && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          You&apos;re done for the day!
        </div>
      )}

      {overflowTasks.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {overflowTasks.length} task{overflowTasks.length > 1 ? "s" : ""} don&apos;t fit in today&apos;s schedule
        </div>
      )}
    </div>
  );
}
