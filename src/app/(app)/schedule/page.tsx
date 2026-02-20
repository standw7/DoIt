"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "@/lib/api";
import { useSettings } from "@/hooks/use-settings";
import { useTasks } from "@/hooks/use-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useRecurringTasks } from "@/hooks/use-recurring-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useRecurringGeneration } from "@/hooks/use-recurring-generation";
import { DateSelector } from "@/components/daily/date-selector";
import { DayTimeline } from "@/components/schedule/day-timeline";
import { ScheduleButton } from "@/components/schedule/schedule-button";
import { ConflictReschedule } from "@/components/schedule/conflict-reschedule";
import { OverdueReview } from "@/components/schedule/overdue-review";
import { todayString, formatMinutes } from "@/lib/utils";
import { getDayCapacity, pickBestDayWithInfo, rebalanceAutoAssigned } from "@/lib/scheduler";
import { format, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RefreshCw, Wand2 } from "lucide-react";
import { Task } from "@/lib/types";
import { toast } from "sonner";

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allTasksLoaded, setAllTasksLoaded] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);

  const {
    settings,
    loading: settingsLoading,
    calendarConnected,
  } = useSettings();

  const { tasks, loading: tasksLoading, updateTask, refetch: refetchDayTasks } = useTasks({ day: selectedDate });

  // Fetch 14-day window so auto-assign has full calendar picture
  const futureStr = useMemo(() => format(addDays(new Date(), 14), "yyyy-MM-dd"), []);
  const { events: allEvents, loading: eventsLoading, error: calendarError, refetch: refetchEvents, removeEvent } = useCalendarEvents(
    todayString(),
    futureStr
  );

  // Filter to selected date for display components
  const events = useMemo(
    () => allEvents.filter((e) => e.start.startsWith(selectedDate) || e.allDay),
    [allEvents, selectedDate]
  );

  const { recurringTasks } = useRecurringTasks();
  const { projects } = useProjects();

  const projectMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) map[p.id] = p.name;
    return map;
  }, [projects]);

  const fetchAllTasks = useCallback(async () => {
    try {
      const data = await api.getTasks();
      setAllTasks(data);
      setAllTasksLoaded(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  // Auto-generate recurring task instances (only after allTasks has been fetched to avoid duplicates)
  useRecurringGeneration(recurringTasks, allTasksLoaded ? allTasks : null, fetchAllTasks);

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
    let overBudgetDays = new Set<string>();
    let currentTasks = [...allTasks];

    // Sort by due date (earliest first) so urgent tasks claim the best days first
    const sorted = [...unassignedTasks].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

    for (const task of sorted) {
      const estimatedMinutes = task.estimated_minutes ?? 30;
      const result = pickBestDayWithInfo({
        task: {
          estimated_minutes: estimatedMinutes,
          due_date: task.due_date,
          priority: task.priority,
          available_from: task.available_from,
        },
        existingTasks: currentTasks,
        calendarEvents: allEvents,
        workingHoursStart: settings.working_hours_start,
        workingHoursEnd: settings.working_hours_end,
        dailyBudget: settings.daily_minutes_budget,
        skipWeekends: settings.skip_weekends,
      });

      if (result.overBudget) {
        overBudgetDays.add(result.date);
      }

      try {
        await updateTask(task.id, {
          day: result.date,
          status: "planned",
          estimated_minutes: estimatedMinutes,
          auto_assigned: true,
        });
        currentTasks = currentTasks.map((t) =>
          t.id === task.id ? { ...t, day: result.date, status: "planned" as const, estimated_minutes: estimatedMinutes } : t
        );
        assigned++;
      } catch {
        // continue
      }
    }

    await fetchAllTasks();
    await refetchDayTasks();
    setAssigning(false);
    toast.success(`Auto-assigned ${assigned} task${assigned > 1 ? "s" : ""} to days`);
    if (overBudgetDays.size > 0) {
      toast.warning(
        `${overBudgetDays.size} day${overBudgetDays.size > 1 ? "s" : ""} exceed${overBudgetDays.size === 1 ? "s" : ""} your daily budget — too many tasks due with no earlier availability`,
        { duration: 6000 }
      );
    }
  }

  async function handleRebalance() {
    setRebalancing(true);
    try {
      const freshTasks = await api.getTasks();
      const changes = rebalanceAutoAssigned({
        tasks: freshTasks,
        calendarEvents: allEvents,
        workingHoursStart: settings.working_hours_start,
        workingHoursEnd: settings.working_hours_end,
        dailyBudget: settings.daily_minutes_budget,
        skipWeekends: settings.skip_weekends,
      });

      for (const { id, newDay } of changes) {
        await api.updateTask(id, { day: newDay });
      }

      await fetchAllTasks();
      await refetchDayTasks();

      if (changes.length > 0) {
        toast.success(`Rebalanced ${changes.length} task${changes.length > 1 ? "s" : ""}`);
      } else {
        toast.info("Schedule is already optimal");
      }
    } catch {
      toast.error("Failed to rebalance");
    } finally {
      setRebalancing(false);
    }
  }

  async function handleClearTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId) ?? allTasks.find((t) => t.id === taskId);
    // Optimistically remove the calendar event from local state immediately
    if (task?.google_event_id) {
      removeEvent(task.google_event_id);
    }
    // Update task in background — no await chain that blocks UI
    updateTask(taskId, { day: null, status: "backlog", auto_assigned: false, google_event_id: null } as any);
    fetchAllTasks();
    toast.success("Task cleared — ready for reassignment");
    // Delete calendar event in background
    if (task?.google_event_id) {
      api.deleteCalendarEvent(task.google_event_id).catch(() => {});
      refetchEvents();
    }
  }

  async function handleRemoveFromCalendar(task: Task) {
    if (!task.google_event_id) return;
    // Optimistically remove from local state immediately
    removeEvent(task.google_event_id);
    updateTask(task.id, { google_event_id: null, status: "planned" } as any);
    toast.success("Removed from calendar");
    // Delete in background
    api.deleteCalendarEvent(task.google_event_id).catch(() => {});
    refetchEvents();
  }

  async function handleEventCreated(taskId: string, eventId: string) {
    await updateTask(taskId, { google_event_id: eventId });
    await refetchEvents();
  }

  async function handleOverdueUpdate(id: string, updates: Record<string, any>) {
    await updateTask(id, updates);
    await refetchDayTasks();
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
          skipWeekends={settings.skip_weekends}
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

      {/* Calendar error */}
      {calendarError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {calendarError}
        </div>
      )}

      {/* Auto-assign + rebalance buttons */}
      <div className="flex gap-2">
        {unassignedTasks.length > 0 && (
          <Button
            onClick={handleAutoAssignAll}
            disabled={assigning || rebalancing}
            variant="outline"
            className="flex-1"
          >
            {assigning ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Assign {unassignedTasks.length} task{unassignedTasks.length > 1 ? "s" : ""}
          </Button>
        )}
        <Button
          onClick={handleRebalance}
          disabled={assigning || rebalancing}
          variant="outline"
          className={unassignedTasks.length > 0 ? "" : "w-full"}
        >
          {rebalancing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Rebalance schedule
        </Button>
      </div>

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
          isToday={selectedDate === today}
          projectMap={projectMap}
          onClearTask={handleClearTask}
          onRemoveFromCalendar={handleRemoveFromCalendar}
        />
      )}

      {/* Conflict detection + reschedule */}
      {!loading && calendarConnected && (
        <ConflictReschedule
          date={selectedDate}
          tasks={tasks}
          events={events}
          workStart={settings.working_hours_start}
          workEnd={settings.working_hours_end}
          onRescheduled={refetchEvents}
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
