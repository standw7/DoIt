"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSettings } from "@/hooks/use-settings";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useRecurringTasks } from "@/hooks/use-recurring-tasks";
import { Task } from "@/lib/types";
import { todayString, formatMinutes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog";
import { RecurringTasksSection } from "@/components/settings/recurring-tasks-section";
import { Loader2, ListTodo, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function TasksPage() {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

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
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    setAllTasks((data ?? []) as Task[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchAllTasks();

    const channel = supabase
      .channel("tasks-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchAllTasks())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAllTasks, supabase]);

  async function handleCreateTask(task: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({ ...task, user_id: user.id });
    if (error) throw error;
    await fetchAllTasks();
  }

  // Split tasks into one-time and recurring
  const oneTimeTasks = allTasks.filter((t) => !t.recurring_task_id);
  const activeTasks = oneTimeTasks.filter((t) => t.status !== "done" && t.status !== "skipped");
  const completedTasks = oneTimeTasks.filter((t) => t.status === "done" || t.status === "skipped");

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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4" />
              One-Time Tasks
              <Badge variant="secondary">{activeTasks.length}</Badge>
            </CardTitle>
            <CreateTaskDialog
              existingTasks={allTasks}
              calendarEvents={events}
              workingHoursStart={settings.working_hours_start}
              workingHoursEnd={settings.working_hours_end}
              dailyBudget={settings.daily_minutes_budget}
              onCreate={handleCreateTask}
            />
          </div>
        </CardHeader>
        <CardContent>
          {activeTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active tasks
            </p>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((task) => (
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
                  <div className="flex items-center gap-2 shrink-0">
                    {task.estimated_minutes && (
                      <Badge variant="outline" className="text-xs">
                        {formatMinutes(task.estimated_minutes)}
                      </Badge>
                    )}
                    <Badge
                      variant="secondary"
                      className="text-xs"
                    >
                      {task.status}
                    </Badge>
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
      </Card>

      {/* Recurring tasks */}
      <RecurringTasksSection
        recurringTasks={recurringTasks}
        onCreate={createRecurringTask}
        onUpdate={updateRecurringTask}
        onDelete={deleteRecurringTask}
      />
    </div>
  );
}
