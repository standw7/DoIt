"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "@/lib/api";
import { useSettings } from "@/hooks/use-settings";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { Task } from "@/lib/types";
import { todayString, formatMinutes } from "@/lib/utils";
import { pickBestDay, WeeklyBudgets } from "@/lib/scheduler";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  SkipForward,
  RefreshCw,
  Loader2,
  PartyPopper,
} from "lucide-react";
import { toast } from "sonner";

export default function OverduePage() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const { settings, loading: settingsLoading } = useSettings();

  const futureStr = useMemo(
    () => format(addDays(new Date(), 14), "yyyy-MM-dd"),
    []
  );
  const { events: calendarEvents, loading: eventsLoading } =
    useCalendarEvents(todayString(), futureStr);

  const fetchAllTasks = useCallback(async () => {
    try {
      const data = await api.getTasks();
      setAllTasks(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  const today = todayString();

  const overdueTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.day && t.day < today && t.status === "planned")
        .sort((a, b) => (a.day ?? "").localeCompare(b.day ?? "")),
    [allTasks, today]
  );

  const weeklyBudgets: WeeklyBudgets = useMemo(
    () => ({
      enabled: settings.custom_weekly_budgets_enabled,
      monday: settings.budget_monday,
      tuesday: settings.budget_tuesday,
      wednesday: settings.budget_wednesday,
      thursday: settings.budget_thursday,
      friday: settings.budget_friday,
      saturday: settings.budget_saturday,
      sunday: settings.budget_sunday,
    }),
    [settings]
  );

  const isLoading = loading || settingsLoading || eventsLoading;

  async function handleReschedule(task: Task) {
    setProcessing(task.id);
    try {
      const estimatedMinutes = task.estimated_minutes ?? 30;
      const bestDay = pickBestDay({
        task: {
          estimated_minutes: estimatedMinutes,
          due_date: task.due_date,
          priority: task.priority,
          prefer_weekend: task.prefer_weekend,
        },
        existingTasks: allTasks,
        calendarEvents,
        workingHoursStart: settings.working_hours_start,
        workingHoursEnd: settings.working_hours_end,
        dailyBudget: settings.daily_minutes_budget,
        skipWeekends: settings.skip_weekends,
      });

      await api.updateTask(task.id, {
        day: bestDay,
        status: "planned",
        estimated_minutes: estimatedMinutes,
        google_event_id: null,
        auto_assigned: true,
      });

      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, day: bestDay, status: "planned" as const, estimated_minutes: estimatedMinutes }
            : t
        )
      );
      toast.success(`"${task.name}" rescheduled to ${bestDay}`);
    } catch {
      toast.error("Failed to reschedule task");
    } finally {
      setProcessing(null);
    }
  }

  async function handleMarkDone(task: Task) {
    setProcessing(task.id);
    try {
      await api.updateTask(task.id, { status: "done" });
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "done" as const } : t
        )
      );
      toast.success(`"${task.name}" marked done`);
    } catch {
      toast.error("Failed to update task");
    } finally {
      setProcessing(null);
    }
  }

  async function handleSkip(task: Task) {
    setProcessing(task.id);
    try {
      await api.updateTask(task.id, { status: "skipped" });
      setAllTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: "skipped" as const } : t
        )
      );
    } catch {
      toast.error("Failed to skip task");
    } finally {
      setProcessing(null);
    }
  }

  async function handleRescheduleAll() {
    setProcessing("all");
    let rescheduled = 0;
    let currentTasks = [...allTasks];

    for (const task of overdueTasks) {
      const estimatedMinutes = task.estimated_minutes ?? 30;
      const bestDay = pickBestDay({
        task: {
          estimated_minutes: estimatedMinutes,
          due_date: task.due_date,
          priority: task.priority,
          prefer_weekend: task.prefer_weekend,
        },
        existingTasks: currentTasks,
        calendarEvents,
        workingHoursStart: settings.working_hours_start,
        workingHoursEnd: settings.working_hours_end,
        dailyBudget: settings.daily_minutes_budget,
        skipWeekends: settings.skip_weekends,
      });

      try {
        await api.updateTask(task.id, {
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

    setAllTasks(currentTasks);
    setProcessing(null);
    toast.success(
      `Rescheduled ${rescheduled} overdue task${rescheduled > 1 ? "s" : ""}`
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Overdue
        </h1>
        {overdueTasks.length > 0 && (
          <Badge variant="secondary">{overdueTasks.length}</Badge>
        )}
      </div>

      {overdueTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <PartyPopper className="h-10 w-10 mb-3" />
          <p className="text-base font-medium">All caught up!</p>
          <p className="text-sm">No overdue tasks</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            These tasks were planned for past days but never completed.
          </p>

          <div className="space-y-3">
            {overdueTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3"
              >
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
          </div>

          {overdueTasks.length > 1 && (
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
              Reschedule all {overdueTasks.length} tasks
            </Button>
          )}
        </>
      )}
    </div>
  );
}
