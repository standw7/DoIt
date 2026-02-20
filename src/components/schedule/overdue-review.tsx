"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Task, CalendarEvent } from "@/lib/types";
import { formatMinutes, todayString } from "@/lib/utils";
import { AlertTriangle, Check, SkipForward, RefreshCw, Loader2 } from "lucide-react";
import { pickBestDay } from "@/lib/scheduler";
import { toast } from "sonner";

interface OverdueReviewProps {
  overdueTasks: Task[];
  allTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  skipWeekends?: boolean;
  onUpdateTask: (id: string, updates: Record<string, any>) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function OverdueReview({
  overdueTasks,
  allTasks,
  calendarEvents,
  workingHoursStart,
  workingHoursEnd,
  dailyBudget,
  skipWeekends = false,
  onUpdateTask,
  onRefresh,
}: OverdueReviewProps) {
  const [processing, setProcessing] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  if (overdueTasks.length === 0) return null;

  const visibleTasks = overdueTasks.filter((t) => !dismissed.has(t.id));
  if (visibleTasks.length === 0) return null;

  async function handleReschedule(task: Task) {
    setProcessing(task.id);
    try {
      const estimatedMinutes = task.estimated_minutes ?? 30;
      const bestDay = pickBestDay({
        task: {
          estimated_minutes: estimatedMinutes,
          due_date: task.due_date,
          priority: task.priority,
        },
        existingTasks: allTasks,
        calendarEvents,
        workingHoursStart,
        workingHoursEnd,
        dailyBudget,
        skipWeekends,
      });

      await onUpdateTask(task.id, {
        day: bestDay,
        status: "planned",
        estimated_minutes: estimatedMinutes,
        google_event_id: null,
        auto_assigned: true,
      });

      setDismissed((prev) => new Set(prev).add(task.id));
      toast.success(`"${task.name}" rescheduled to ${bestDay}`);
      await onRefresh();
    } catch {
      toast.error("Failed to reschedule task");
    } finally {
      setProcessing(null);
    }
  }

  async function handleMarkDone(task: Task) {
    setProcessing(task.id);
    try {
      await onUpdateTask(task.id, { status: "done" });
      setDismissed((prev) => new Set(prev).add(task.id));
      await onRefresh();
    } catch {
      toast.error("Failed to update task");
    } finally {
      setProcessing(null);
    }
  }

  async function handleSkip(task: Task) {
    setProcessing(task.id);
    try {
      await onUpdateTask(task.id, { status: "skipped" });
      setDismissed((prev) => new Set(prev).add(task.id));
      await onRefresh();
    } catch {
      toast.error("Failed to update task");
    } finally {
      setProcessing(null);
    }
  }

  async function handleRescheduleAll() {
    setProcessing("all");
    let rescheduled = 0;
    let currentTasks = [...allTasks];

    for (const task of visibleTasks) {
      const estimatedMinutes = task.estimated_minutes ?? 30;
      const bestDay = pickBestDay({
        task: {
          estimated_minutes: estimatedMinutes,
          due_date: task.due_date,
          priority: task.priority,
        },
        existingTasks: currentTasks,
        calendarEvents,
        workingHoursStart,
        workingHoursEnd,
        dailyBudget,
        skipWeekends,
      });

      try {
        await onUpdateTask(task.id, {
          day: bestDay,
          status: "planned",
          estimated_minutes: estimatedMinutes,
          google_event_id: null,
          auto_assigned: true,
        });
        currentTasks = currentTasks.map((t) =>
          t.id === task.id
            ? { ...t, day: bestDay, status: "planned" as const, estimated_minutes: estimatedMinutes }
            : t
        );
        rescheduled++;
      } catch {
        // continue
      }
    }

    setDismissed((prev) => {
      const next = new Set(prev);
      visibleTasks.forEach((t) => next.add(t.id));
      return next;
    });
    await onRefresh();
    setProcessing(null);
    toast.success(`Rescheduled ${rescheduled} overdue task${rescheduled > 1 ? "s" : ""}`);
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Overdue Tasks
          <Badge variant="secondary" className="ml-auto">
            {visibleTasks.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          These tasks were planned for past days but never completed
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleTasks.map((task) => (
          <div
            key={task.id}
            className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{task.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    Was scheduled for {task.day}
                  </span>
                  {task.estimated_minutes && (
                    <Badge variant="outline" className="text-xs">
                      {formatMinutes(task.estimated_minutes)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => handleReschedule(task)}
                disabled={processing !== null}
              >
                {processing === task.id ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Reschedule
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleMarkDone(task)}
                disabled={processing !== null}
              >
                <Check className="mr-1 h-3 w-3" />
                Done
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleSkip(task)}
                disabled={processing !== null}
              >
                <SkipForward className="mr-1 h-3 w-3" />
                Skip
              </Button>
            </div>
          </div>
        ))}

        {visibleTasks.length > 1 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRescheduleAll}
            disabled={processing !== null}
          >
            {processing === "all" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Reschedule all {visibleTasks.length} tasks
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
