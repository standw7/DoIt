"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarEvent, Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { Clock, AlertCircle, CheckCircle2, X, CalendarMinus, GripVertical } from "lucide-react";
import { parseISO, format } from "date-fns";

export interface TaskPosition {
  taskId: string;
  startMin: number;
  endMin: number;
}

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
  onTaskPositionsChange?: (positions: TaskPosition[]) => void;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function eventToTimeRange(
  event: CalendarEvent,
  date: string,
  workStartMin: number,
  workEndMin: number
): { startMin: number; endMin: number } | null {
  if (event.allDay) return null;
  if (!event.start.startsWith(date)) return null;

  const eventStart = parseISO(event.start);
  const eventEnd = parseISO(event.end);

  let startMin = eventStart.getHours() * 60 + eventStart.getMinutes();
  let endMin = eventEnd.getHours() * 60 + eventEnd.getMinutes();

  // Handle midnight-crossing events: clamp to end of working hours
  if (endMin <= startMin) {
    endMin = workEndMin;
  }

  // Clamp to working hours
  startMin = Math.max(startMin, workStartMin);
  endMin = Math.min(endMin, workEndMin);

  // Skip if entirely outside working hours
  if (startMin >= workEndMin || endMin <= workStartMin || endMin <= startMin) return null;

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

function minutesToTimeStr(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
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
  onTaskPositionsChange,
}: DayTimelineProps) {
  const workStartMin = timeToMinutes(workStart);
  const workEndMin = timeToMinutes(workEnd);

  // Drag overrides: taskId → startMin (user has dragged this task to a new position)
  const [dragOverrides, setDragOverrides] = useState<Record<string, number>>({});

  // Reset drag overrides when the date or tasks change
  const prevKey = useRef("");
  const currentKey = `${date}-${tasks.map((t) => t.id).join(",")}`;
  if (currentKey !== prevKey.current) {
    prevKey.current = currentKey;
    if (Object.keys(dragOverrides).length > 0) {
      setDragOverrides({});
    }
  }

  // Compute blocks from events and auto-placed tasks
  const { autoBlocks, eventBlocks, overflowTasks } = useMemo(() => {
    // Map google_event_id → task so we can identify task events on the calendar
    const taskByEventId = new Map<string, Task>();
    for (const t of tasks) {
      if (t.google_event_id) taskByEventId.set(t.google_event_id, t);
    }

    // Build event blocks — mark task-owned events as type "task"
    const eventBlocks: TimeBlock[] = [];
    const scheduledTaskEventIds = new Set<string>();
    for (const event of events) {
      const range = eventToTimeRange(event, date, workStartMin, workEndMin);
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

    // Collect unscheduled tasks to auto-stack
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

    // First-fit with 5-minute buffers
    const TASK_GAP = 5;
    const taskBlocks: TimeBlock[] = [];
    const overflowTasks: Task[] = [];

    for (const task of unscheduled) {
      const dur = task.estimated_minutes ?? 30;
      let bestIdx = -1;

      for (let i = 0; i < gapList.length; i++) {
        const available = gapList[i].end - gapList[i].cursor;
        if (available >= dur + TASK_GAP * 2) {
          bestIdx = i;
          break;
        }
      }

      if (bestIdx !== -1) {
        const gap = gapList[bestIdx];
        const startMin = gap.cursor + TASK_GAP;
        taskBlocks.push({
          type: "task",
          id: task.id,
          label: task.name,
          startMin,
          endMin: startMin + dur,
          durationMinutes: dur,
          projectName: task.project_id ? projectMap[task.project_id] : undefined,
        });
        gap.cursor = startMin + dur;
      } else {
        overflowTasks.push(task);
      }
    }

    return { autoBlocks: taskBlocks, eventBlocks, overflowTasks };
  }, [events, tasks, date, workStartMin, workEndMin, projectMap]);

  // Apply drag overrides to task blocks
  const taskBlocks = useMemo(() => {
    return autoBlocks.map((block) => {
      const override = dragOverrides[block.id];
      if (override !== undefined) {
        return { ...block, startMin: override, endMin: override + block.durationMinutes };
      }
      return block;
    });
  }, [autoBlocks, dragOverrides]);

  // Combined sorted blocks for rendering
  const blocks = useMemo(() => {
    return [...eventBlocks, ...taskBlocks].sort((a, b) => a.startMin - b.startMin);
  }, [eventBlocks, taskBlocks]);

  // Notify parent of task positions whenever they change
  const onTaskPositionsChangeRef = useRef(onTaskPositionsChange);
  onTaskPositionsChangeRef.current = onTaskPositionsChange;

  useEffect(() => {
    if (!onTaskPositionsChangeRef.current) return;
    const unscheduledTaskBlocks = taskBlocks.filter(
      (b) => b.type === "task" && !tasks.find((t) => t.id === b.id)?.google_event_id
    );
    // Include all task blocks that don't have google_event_id (not yet on calendar)
    const positions: TaskPosition[] = taskBlocks
      .filter((b) => {
        const task = tasks.find((t) => t.id === b.id);
        return task && !task.google_event_id;
      })
      .map((b) => ({ taskId: b.id, startMin: b.startMin, endMin: b.endMin }));
    onTaskPositionsChangeRef.current(positions);
  }, [taskBlocks, tasks]);

  // Height per hour in rem
  const HOUR_HEIGHT = 3.5;

  // Timeline strictly covers working hours only
  const timelineRange = useMemo(() => {
    const startHour = Math.floor(workStartMin / 60);
    const endHour = Math.ceil(workEndMin / 60);
    return { startHour, endHour, startMin: startHour * 60, totalMinutes: (endHour - startHour) * 60 };
  }, [workStartMin, workEndMin]);

  const timelineHours = useMemo(() => {
    const result: number[] = [];
    for (let h = timelineRange.startHour; h <= timelineRange.endHour; h++) {
      result.push(h);
    }
    return result;
  }, [timelineRange]);

  // Layout pass: compute adjusted positions so blocks never visually overlap
  const layoutBlocks = useMemo(() => {
    const result: { block: TimeBlock; topRem: number; heightRem: number }[] = [];
    let prevVisualBottom = 0;

    for (const block of blocks) {
      const naturalTopRem = ((block.startMin - timelineRange.startMin) / 60) * HOUR_HEIGHT;
      const heightRem = Math.max((block.durationMinutes / 60) * HOUR_HEIGHT, 2.5);
      // Push down if this block would overlap the previous block's visual extent
      const topRem = Math.max(naturalTopRem, prevVisualBottom);
      result.push({ block, topRem, heightRem });
      prevVisualBottom = topRem + heightRem;
    }

    return result;
  }, [blocks, timelineRange.startMin, HOUR_HEIGHT]);

  // Timeline height: use grid height or last block's visual bottom, whichever is larger
  const timelineHeightRem = useMemo(() => {
    const gridHeight = (timelineRange.endHour - timelineRange.startHour) * HOUR_HEIGHT;
    if (layoutBlocks.length === 0) return gridHeight;
    const last = layoutBlocks[layoutBlocks.length - 1];
    const maxBlockBottom = last.topRem + last.heightRem;
    return Math.max(gridHeight, maxBlockBottom);
  }, [timelineRange, HOUR_HEIGHT, layoutBlocks]);

  // --- Drag and drop ---
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    taskId: string;
    startY: number;
    startMinOriginal: number;
    durationMinutes: number;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const remToPx = useCallback(() => {
    return parseFloat(getComputedStyle(document.documentElement).fontSize);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, block: TimeBlock) => {
      // Only allow dragging unscheduled task blocks
      const task = tasks.find((t) => t.id === block.id);
      if (!task || task.google_event_id) return;
      if (block.type !== "task") return;

      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      dragState.current = {
        taskId: block.id,
        startY: e.clientY,
        startMinOriginal: block.startMin,
        durationMinutes: block.durationMinutes,
      };
      setDraggingId(block.id);
    },
    [tasks]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current || !timelineRef.current) return;

      const pxPerRem = remToPx();
      const pxPerMinute = (HOUR_HEIGHT * pxPerRem) / 60;
      const deltaY = e.clientY - dragState.current.startY;
      const deltaMin = Math.round(deltaY / pxPerMinute / 5) * 5; // Snap to 5-min increments

      const newStartMin = Math.max(
        workStartMin,
        Math.min(
          workEndMin - dragState.current.durationMinutes,
          dragState.current.startMinOriginal + deltaMin
        )
      );

      setDragOverrides((prev) => ({
        ...prev,
        [dragState.current!.taskId]: newStartMin,
      }));
    },
    [workStartMin, workEndMin, remToPx]
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
    setDraggingId(null);
  }, []);

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
              ref={timelineRef}
              className="relative flex-1 border-l border-border/50"
              style={{ height: `${timelineHeightRem}rem` }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
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
              {layoutBlocks.map(({ block, topRem, heightRem }) => {
                const useCalendarColor = block.type === "event" && block.color;
                const isDraggable =
                  block.type === "task" &&
                  !tasks.find((t) => t.id === block.id)?.google_event_id;
                const isDragging = draggingId === block.id;

                return (
                  <div
                    key={block.id}
                    className={cn(
                      "absolute left-1 right-1 rounded-md px-3 py-1 text-xs overflow-hidden z-10",
                      !useCalendarColor && block.type === "event" &&
                        "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                      block.type === "task" &&
                        "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
                      isDraggable && "cursor-grab",
                      isDragging && "cursor-grabbing ring-2 ring-green-500 shadow-lg z-20"
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
                      ...(isDragging ? { opacity: 0.9 } : {}),
                    }}
                    onPointerDown={isDraggable ? (e) => handlePointerDown(e, block) : undefined}
                  >
                    <div className="flex items-start justify-between gap-1 h-full">
                      <div className="flex items-start gap-1 min-w-0">
                        {isDraggable && (
                          <GripVertical className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-40" />
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate">{block.label}</div>
                          <div className="opacity-70">
                            {minutesToTimeStr(block.startMin)}–{minutesToTimeStr(block.endMin)}
                            {block.projectName && (
                              <span className="ml-1.5">· {block.projectName}</span>
                            )}
                          </div>
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
        // Build lookup for task time ranges from all blocks
        const blockTimeMap = new Map<string, { startMin: number; endMin: number }>();
        for (const b of blocks) {
          blockTimeMap.set(b.id, { startMin: b.startMin, endMin: b.endMin });
        }
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Tasks on this day ({activeTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeTasks.map((task) => {
                const timeRange = blockTimeMap.get(task.id);
                return (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{task.name}</span>
                    {timeRange && (
                      <span className="ml-2 text-muted-foreground">
                        {minutesToTimeStr(timeRange.startMin)}–{minutesToTimeStr(timeRange.endMin)}
                      </span>
                    )}
                    {!timeRange && task.estimated_minutes && (
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
                );
              })}
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
