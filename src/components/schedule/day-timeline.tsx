"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarEvent, Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle2, X, CalendarMinus } from "lucide-react";
import { parseISO, format } from "date-fns";

interface DayTimelineProps {
  date: string;
  events: CalendarEvent[];
  tasks: Task[];
  workStart: string;
  workEnd: string;
  isToday?: boolean;
  projectMap?: Record<string, string>;
  onClearTask?: (taskId: string) => void;
  onRemoveFromCalendar?: (task: Task) => void;
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
  color?: string;
  projectName?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace("#", "").match(/.{2}/g);
  if (!match || match.length < 3) return null;
  return { r: parseInt(match[0], 16), g: parseInt(match[1], 16), b: parseInt(match[2], 16) };
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#1f2937";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#1f2937" : "#ffffff";
}

export function DayTimeline({
  date,
  events,
  tasks,
  workStart,
  workEnd,
  isToday = false,
  projectMap = {},
  onClearTask,
  onRemoveFromCalendar,
}: DayTimelineProps) {
  const workStartMin = timeToMinutes(workStart);
  const workEndMin = timeToMinutes(workEnd);


  const { blocks, overflowTasks } = useMemo(() => {
    // Map google_event_id → task so we can identify task events on the calendar
    const taskByEventId = new Map<string, Task>();
    for (const t of tasks) {
      if (t.google_event_id) taskByEventId.set(t.google_event_id, t);
    }

    // Build event blocks — mark task-owned events as type "task"
    const eventBlocks: TimeBlock[] = [];
    const scheduledTaskEventIds = new Set<string>();
    for (const event of events) {
      const range = eventToTimeRange(event, date, workEndMin);
      if (!range) continue;
      const matchedTask = taskByEventId.get(event.id);
      if (matchedTask) {
        // This calendar event belongs to a DoIt task — render as green task block
        scheduledTaskEventIds.add(matchedTask.id);
        eventBlocks.push({
          type: "task",
          id: matchedTask.id,
          label: matchedTask.name,
          startMin: range.startMin,
          endMin: range.endMin,
          durationMinutes: range.endMin - range.startMin,
          projectName: matchedTask.project_id ? projectMap[matchedTask.project_id] : undefined,
        });
      } else {
        eventBlocks.push({
          type: "event",
          id: event.id,
          label: event.summary,
          startMin: range.startMin,
          endMin: range.endMin,
          durationMinutes: range.endMin - range.startMin,
          color: event.color,
        });
      }
    }

    // Collect unscheduled tasks to auto-stack — shortest first for best-fit
    // Use 30 min default for tasks without an estimate so they still show on the timeline
    // Skip tasks already shown via their calendar event above
    const unscheduled = tasks
      .filter(
        (t) =>
          t.status === "planned" &&
          !t.google_event_id &&
          !scheduledTaskEventIds.has(t.id)
      )
      .sort((a, b) => (a.estimated_minutes ?? 30) - (b.estimated_minutes ?? 30));

    // Sort events by start time to find gaps
    const sorted = [...eventBlocks].sort((a, b) => a.startMin - b.startMin);

    // Build list of free gaps within working hours
    const gapList: { start: number; cursor: number; end: number }[] = [];
    let gapBuildCursor = workStartMin;
    for (const block of sorted) {
      if (block.startMin > gapBuildCursor) {
        gapList.push({ start: gapBuildCursor, cursor: gapBuildCursor, end: block.startMin });
      }
      gapBuildCursor = Math.max(gapBuildCursor, block.endMin);
    }
    if (gapBuildCursor < workEndMin) {
      gapList.push({ start: gapBuildCursor, cursor: gapBuildCursor, end: workEndMin });
    }

    // Best-fit: for each task, find the smallest gap that fits it
    const taskBlocks: TimeBlock[] = [];
    const overflowTasks: Task[] = [];

    for (const task of unscheduled) {
      const dur = task.estimated_minutes ?? 30;
      let bestIdx = -1;
      let bestAvailable = Infinity;

      for (let i = 0; i < gapList.length; i++) {
        const available = gapList[i].end - gapList[i].cursor;
        if (available >= dur && available < bestAvailable) {
          bestIdx = i;
          bestAvailable = available;
        }
      }

      if (bestIdx !== -1) {
        const gap = gapList[bestIdx];
        taskBlocks.push({
          type: "task",
          id: task.id,
          label: task.name,
          startMin: gap.cursor,
          endMin: gap.cursor + dur,
          durationMinutes: dur,
          projectName: task.project_id ? projectMap[task.project_id] : undefined,
        });
        gap.cursor += dur;
      } else {
        overflowTasks.push(task);
      }
    }

    const allBlocks = [...eventBlocks, ...taskBlocks].sort(
      (a, b) => a.startMin - b.startMin
    );

    return { blocks: allBlocks, overflowTasks };
  }, [events, tasks, date, workStartMin, workEndMin, projectMap]);

  // Height per hour in rem
  const HOUR_HEIGHT = 3.5;

  // Compute the full visible range including blocks that extend past work hours
  const timelineRange = useMemo(() => {
    let minMin = workStartMin;
    let maxMin = workEndMin;
    for (const b of blocks) {
      if (b.startMin < minMin) minMin = b.startMin;
      if (b.endMin > maxMin) maxMin = b.endMin;
    }
    const startHour = Math.floor(minMin / 60);
    const endHour = Math.ceil(maxMin / 60);
    return { startHour, endHour, startMin: startHour * 60, totalMinutes: (endHour - startHour) * 60 };
  }, [blocks, workStartMin, workEndMin]);

  const timelineHours = useMemo(() => {
    const result: number[] = [];
    for (let h = timelineRange.startHour; h <= timelineRange.endHour; h++) {
      result.push(h);
    }
    return result;
  }, [timelineRange]);

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
          <div className="flex">
            {/* Hour labels column */}
            <div className="w-16 shrink-0">
              {timelineHours.map((hour) => (
                <div
                  key={hour}
                  style={{ height: `${HOUR_HEIGHT}rem` }}
                  className="flex items-start justify-end pr-3 pt-0.5"
                >
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(2000, 0, 1, hour % 24), "h a")}
                  </span>
                </div>
              ))}
            </div>

            {/* Timeline blocks column — absolute positioned */}
            <div
              className="relative flex-1 border-l border-border/50"
              style={{ height: `${(timelineRange.endHour - timelineRange.startHour) * HOUR_HEIGHT}rem` }}
            >
              {/* Hour grid lines */}
              {timelineHours.slice(0, -1).map((hour, i) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-border/30"
                  style={{ top: `${i * HOUR_HEIGHT}rem` }}
                />
              ))}

              {/* Blocks */}
              {blocks.map((block) => {
                const topRem = ((block.startMin - timelineRange.startMin) / 60) * HOUR_HEIGHT;
                const heightRem = Math.max((block.durationMinutes / 60) * HOUR_HEIGHT, 1.5);
                const useCalendarColor = block.type === "event" && block.color;
                return (
                  <div
                    key={block.id}
                    className={cn(
                      "absolute left-1 right-1 rounded-md px-3 py-1 text-xs overflow-hidden z-10",
                      !useCalendarColor && block.type === "event" &&
                        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                      block.type === "task" &&
                        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                    )}
                    style={{
                      top: `${topRem}rem`,
                      height: `${heightRem}rem`,
                      ...(useCalendarColor
                        ? {
                            backgroundColor: block.color,
                            color: getContrastColor(block.color!),
                          }
                        : {}),
                    }}
                  >
                    <div className="flex items-start justify-between gap-1 h-full">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{block.label}</div>
                        <div className="opacity-70">
                          {formatMinutes(block.durationMinutes)}
                          {block.projectName && (
                            <span className="ml-1.5">· {block.projectName}</span>
                          )}
                        </div>
                      </div>
                      {block.type === "task" && onClearTask && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onClearTask(block.id); }}
                          className="shrink-0 rounded-full p-0.5 bg-red-500/15 text-red-600 hover:bg-red-500/30 dark:text-red-400 dark:hover:bg-red-500/30"
                          title="Clear task (move to unassigned)"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {(() => {
        const activeTasks = tasks.filter((t) => t.status !== "done" && t.status !== "skipped");
        if (activeTasks.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Tasks on this day ({activeTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{task.name}</span>
                    {task.estimated_minutes && (
                      <span className="ml-2 text-muted-foreground">
                        {formatMinutes(task.estimated_minutes)}
                      </span>
                    )}
                    {task.project_id && projectMap[task.project_id] && (
                      <span className="ml-1.5 text-muted-foreground">
                        · {projectMap[task.project_id]}
                      </span>
                    )}
                    {task.google_event_id && (
                      <span className="ml-1.5 text-xs text-blue-500">on calendar</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {onRemoveFromCalendar && task.google_event_id && (
                      <button
                        onClick={() => onRemoveFromCalendar(task)}
                        className="rounded p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                        title="Remove from calendar"
                      >
                        <CalendarMinus className="h-4 w-4" />
                      </button>
                    )}
                    {onClearTask && (
                      <button
                        onClick={() => onClearTask(task.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                        title="Unassign from this day"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

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
