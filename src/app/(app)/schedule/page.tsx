"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useTasks } from "@/hooks/use-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useRecurringTasks } from "@/hooks/use-recurring-tasks";
import { useRecurringGeneration } from "@/hooks/use-recurring-generation";
import { DateSelector } from "@/components/daily/date-selector";
import { DayTimeline } from "@/components/schedule/day-timeline";
import { ScheduleButton } from "@/components/schedule/schedule-button";
import { OverdueReview } from "@/components/schedule/overdue-review";
import { todayString, formatMinutes } from "@/lib/utils";
import { getDayCapacity, pickBestDay } from "@/lib/scheduler";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Wand2 } from "lucide-react";
import { Task } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [assigning, setAssigning] = useState(false);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const {
    settings,
    loading: settingsLoading,
    calendarConnected,
  } = useSettings();

  const { tasks, loading: tasksLoading, updateTask } = useTasks({ day: selectedDate });
  const { events, loading: eventsLoading, refetch: refetchEvents } = useCalendarEvents(
    selectedDate,
    selectedDate
  );

  const { recurringTasks } = useRecurringTasks();

  const fetchAllTasks = useCallback(async () => {
    const { data } = await supabase.from("tasks").select("*").order("created_at");
    setAllTasks((data ?? []) as Task[]);
  }, [supabase]);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  // Auto-generate recurring task instances
  useRecurringGeneration(recurringTasks, allTasks, fetchAllTasks);

  const loading = settingsLoading || tasksLoading || eventsLoading;

  const capacity = getDayCapacity(
    selectedDate,
    tasks,
    events,
    settings.working_hours_start,
    settings.working_hours_end
  );

  const today = todayString();

  // Tasks with no day assigned
  const unassignedTasks = allTasks.filter(
    (t) => !t.day && t.status !== "done" && t.status !== "skipped"
  );

  // Overdue tasks: planned for a past day, not done/skipped
  const overdueTasks = allTasks.filter(
    (t) =>
      t.day &&
      t.day < today &&
      t.status === "planned"
  );

  async function handleAutoAssignAll() {
    if (unassignedTasks.length === 0) return;
    setAssigning(true);

    let assigned = 0;
    let currentTasks = [...allTasks];

    for (const task of unassignedTasks) {
      const estimatedMinutes = task.estimated_minutes ?? 30;
      const bestDay = pickBestDay({
        task: {
          estimated_minutes: estimatedMinutes,
          due_date: task.due_date,
          priority: task.priority,
        },
        existingTasks: currentTasks,
        calendarEvents: events,
        workingHoursStart: settings.working_hours_start,
        workingHoursEnd: settings.working_hours_end,
        dailyBudget: settings.daily_minutes_budget,
      });

      try {
        await updateTask(task.id, {
          day: bestDay,
          status: "planned",
          estimated_minutes: estimatedMinutes,
          auto_assigned: true,
        });
        currentTasks = currentTasks.map((t) =>
          t.id === task.id ? { ...t, day: bestDay, status: "planned" as const, estimated_minutes: estimatedMinutes } : t
        );
        assigned++;
      } catch {
        // continue
      }
    }

    await fetchAllTasks();
    setAssigning(false);
    toast.success(`Auto-assigned ${assigned} task${assigned > 1 ? "s" : ""} to days`);
  }

  async function handleEventCreated(taskId: string, eventId: string) {
    await updateTask(taskId, { google_event_id: eventId });
    await refetchEvents();
  }

  async function handleOverdueUpdate(id: string, updates: Record<string, any>) {
    await updateTask(id, updates);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      {/* Overdue tasks review — always at top */}
      {overdueTasks.length > 0 && (
        <OverdueReview
          overdueTasks={overdueTasks}
          allTasks={allTasks}
          calendarEvents={events}
          workingHoursStart={settings.working_hours_start}
          workingHoursEnd={settings.working_hours_end}
          dailyBudget={settings.daily_minutes_budget}
          onUpdateTask={handleOverdueUpdate}
          onRefresh={fetchAllTasks}
        />
      )}

      {/* Date selector + capacity summary */}
      <div className="flex flex-col items-center gap-3">
        <DateSelector date={selectedDate} onChange={setSelectedDate} />
        {!loading && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              {formatMinutes(capacity.freeMinutes)} free
            </Badge>
            <span>of {formatMinutes(capacity.totalMinutes)} working</span>
            {capacity.eventMinutes > 0 && (
              <Badge variant="secondary">
                {formatMinutes(capacity.eventMinutes)} in events
              </Badge>
            )}
            {capacity.taskMinutes > 0 && (
              <Badge variant="secondary">
                {formatMinutes(capacity.taskMinutes)} in tasks
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Auto-assign unassigned tasks */}
      {unassignedTasks.length > 0 && (
        <Button
          onClick={handleAutoAssignAll}
          disabled={assigning}
          variant="outline"
          className="w-full"
        >
          {assigning ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Auto-assign {unassignedTasks.length} unassigned task{unassignedTasks.length > 1 ? "s" : ""} to days
        </Button>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Day timeline */}
      {!loading && (
        <DayTimeline
          date={selectedDate}
          events={events}
          tasks={tasks}
          workStart={settings.working_hours_start}
          workEnd={settings.working_hours_end}
        />
      )}

      {/* Schedule to calendar button */}
      {!loading && calendarConnected && (
        <ScheduleButton
          date={selectedDate}
          tasks={tasks}
          events={events}
          workStart={settings.working_hours_start}
          workEnd={settings.working_hours_end}
          onEventCreated={handleEventCreated}
        />
      )}
    </div>
  );
}
