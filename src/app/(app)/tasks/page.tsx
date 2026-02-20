"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "@/lib/api";
import { useSettings } from "@/hooks/use-settings";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useRecurringTasks } from "@/hooks/use-recurring-tasks";
import { Task } from "@/lib/types";
import { todayString, formatMinutes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { RecurringTasksSection } from "@/components/settings/recurring-tasks-section";
import { Loader2, ListTodo, CheckCircle2, ChevronDown, Pencil, X } from "lucide-react";
import { TaskDetailDialog } from "@/components/tasks/task-detail-dialog";
import { format, parseISO, addDays, isBefore, startOfDay } from "date-fns";
import { rebalanceAutoAssigned } from "@/lib/scheduler";

type DateRange = "2days" | "week" | "2weeks" | "all";

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  "2days": "2 Days",
  week: "Week",
  "2weeks": "2 Weeks",
  all: "All",
};

export default function TasksPage() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [oneTimeOpen, setOneTimeOpen] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("2days");
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const { settings } = useSettings();
  const { events } = useCalendarEvents(todayString(), todayString());
  const {
    recurringTasks,
    loading: recurringLoading,
    createRecurringTask,
    updateRecurringTask,
    deleteRecurringTask,
  } = useRecurringTasks();

  const fetchAllTasks = useCallback(async () => {
    try {
      const data = await api.getTasks();
      setAllTasks(data);
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  async function handleCreateTask(task: any) {
    try {
      await api.createTask(task);
      const freshTasks = await api.getTasks();
      setAllTasks(freshTasks);

      // Rebalance auto-assigned tasks for optimal spread
      const changes = rebalanceAutoAssigned({
        tasks: freshTasks,
        calendarEvents: events,
        workingHoursStart: settings.working_hours_start,
        workingHoursEnd: settings.working_hours_end,
        dailyBudget: settings.daily_minutes_budget,
        skipWeekends: settings.skip_weekends,
      });
      for (const { id, newDay } of changes) {
        await api.updateTask(id, { day: newDay });
      }
      if (changes.length > 0) {
        await fetchAllTasks();
      }
    } catch {
      // ignore
    }
  }

  async function handleUpdateTask(id: string, updates: Partial<Task>) {
    try {
      await api.updateTask(id, updates);
      await fetchAllTasks();
    } catch {
      // ignore
    }
  }

  async function handleDeleteTask(id: string) {
    const prev = allTasks;
    setAllTasks((tasks) => tasks.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch {
      setAllTasks(prev);
    }
  }

  // Split tasks into one-time and recurring
  const oneTimeTasks = allTasks.filter((t) => !t.recurring_task_id);
  const activeTasks = oneTimeTasks.filter((t) => t.status !== "done" && t.status !== "skipped");
  const completedTasks = oneTimeTasks.filter((t) => t.status === "done" || t.status === "skipped");

  // Filter active tasks by date range and sort by due_date ascending
  const filteredTasks = useMemo(() => {
    const now = startOfDay(new Date());

    let filtered: Task[];
    if (dateRange === "all") {
      filtered = activeTasks;
    } else {
      const daysMap: Record<string, number> = { "2days": 2, week: 7, "2weeks": 14 };
      const cutoff = addDays(now, daysMap[dateRange]);
      filtered = activeTasks.filter((t) => {
        if (!t.due_date) return true; // no due date always shown
        const due = startOfDay(parseISO(t.due_date));
        if (isBefore(due, now)) return true; // overdue always shown
        return isBefore(due, cutoff) || due.getTime() === cutoff.getTime();
      });
    }

    // Sort by due_date ascending, nulls at end
    return [...filtered].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }, [activeTasks, dateRange]);

  const today = todayString();

  if (loading || recurringLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <h1 className="text-xl font-semibold">Tasks</h1>

      {/* One-time tasks */}
      <Collapsible open={oneTimeOpen} onOpenChange={setOneTimeOpen}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-left">
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${oneTimeOpen ? "rotate-180" : ""}`} />
                  <CardTitle className="flex items-center gap-2 text-base whitespace-nowrap">
                    <ListTodo className="h-4 w-4" />
                    One-Time Tasks
                    <Badge variant="secondary">{filteredTasks.length}</Badge>
                  </CardTitle>
                </button>
              </CollapsibleTrigger>
              <CreateTaskDialog
                existingTasks={allTasks}
                calendarEvents={events}
                workingHoursStart={settings.working_hours_start}
                workingHoursEnd={settings.working_hours_end}
                dailyBudget={settings.daily_minutes_budget}
                skipWeekends={settings.skip_weekends}
                onCreate={handleCreateTask}
              />
            </div>
            {/* Date range filter chips */}
            {oneTimeOpen && (
              <div className="flex gap-1.5 pt-2">
                {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((range) => (
                  <Button
                    key={range}
                    variant={dateRange === range ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-2.5"
                    onClick={() => setDateRange(range)}
                  >
                    {DATE_RANGE_LABELS[range]}
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {filteredTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active tasks
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{task.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.day && (
                            <span className="text-xs text-muted-foreground">
                              {task.day === today ? "Today" : format(parseISO(task.day), "MMM d")}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Due {format(parseISO(task.due_date), "MMM d")}
                            </span>
                          )}
                          {task.priority !== "medium" && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${task.priority === "high" ? "border-red-300 text-red-600" : "border-blue-300 text-blue-600"}`}
                            >
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {task.estimated_minutes && (
                          <Badge variant="outline" className="text-xs">
                            {formatMinutes(task.estimated_minutes)}
                          </Badge>
                        )}
                        <button
                          onClick={() => setEditingTask(task)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                          title="Edit task"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                          title="Delete task"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed tasks (collapsed) */}
              {completedTasks.length > 0 && (
                <details className="mt-4">
                  <summary className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <CheckCircle2 className="h-4 w-4" />
                    {completedTasks.length} completed
                  </summary>
                  <div className="space-y-2 mt-2">
                    {completedTasks.slice(0, 20).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm text-muted-foreground"
                      >
                        <span className="line-through">{task.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {task.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Recurring tasks */}
      <RecurringTasksSection
        recurringTasks={recurringTasks}
        onCreate={createRecurringTask}
        onUpdate={updateRecurringTask}
        onDelete={deleteRecurringTask}
      />

      {editingTask && (
        <TaskDetailDialog
          task={editingTask}
          open={true}
          onOpenChange={(open) => { if (!open) setEditingTask(null); }}
          onUpdate={(id, updates) => {
            handleUpdateTask(id, updates);
            setEditingTask(null);
          }}
          onDelete={(id) => {
            handleDeleteTask(id);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}
