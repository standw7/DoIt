"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarEvent, Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { Clock, CalendarDays, ListTodo } from "lucide-react";
import { parseISO, format } from "date-fns";

interface DayTimelineProps {
  date: string;
  events: CalendarEvent[];
  tasks: Task[];
  workStart: string;
  workEnd: string;
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

  const { blocks, unscheduledTasks } = useMemo(() => {
    const blocks: TimeBlock[] = [];

    for (const event of events) {
      const range = eventToTimeRange(event, date, workEndMin);
      if (!range) continue;
      blocks.push({
        type: "event",
        id: event.id,
        label: event.summary,
        startMin: range.startMin,
        endMin: range.endMin,
        durationMinutes: range.endMin - range.startMin,
      });
    }

    const unscheduledTasks = tasks.filter(
      (t) =>
        t.status === "planned" &&
        !t.google_event_id &&
        t.estimated_minutes
    );

    return { blocks, unscheduledTasks };
  }, [events, tasks, date, workEndMin]);

  const hasContent = blocks.length > 0 || unscheduledTasks.length > 0;

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

      {unscheduledTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4" />
              Unscheduled Tasks
              <Badge variant="secondary" className="ml-auto">
                {unscheduledTasks.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unscheduledTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>{task.name}</span>
                  <Badge variant="outline">
                    {formatMinutes(task.estimated_minutes ?? 0)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
