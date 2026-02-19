"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTasks } from "@/hooks/use-tasks";
import { useSettings } from "@/hooks/use-settings";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useProjects } from "@/hooks/use-projects";
import { Task } from "@/lib/types";
import { DateSelector } from "@/components/daily/date-selector";
import { SuggestedTasks } from "@/components/daily/suggested-tasks";
import { TaskCard } from "@/components/tasks/task-card";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ListChecks } from "lucide-react";
import { todayString, getSuggestedTasks } from "@/lib/utils";
import { format, addDays, parseISO } from "date-fns";
import { CalendarEvent } from "@/lib/types";
import { toast } from "sonner";

function TodayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? todayString();
  const [allBacklogTasks, setAllBacklogTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const { settings } = useSettings();
  const { projects } = useProjects();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const futureStr = format(addDays(new Date(), 14), "yyyy-MM-dd");
  const { events: calendarEvents } = useCalendarEvents(todayStr, futureStr);

  const { tasks, loading, createTask, updateTask, deleteTask, toggleDone, assignToDay } = useTasks({ day: date });

  const fetchBacklog = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "backlog")
      .is("day", null);
    setAllBacklogTasks((data ?? []) as Task[]);
  }, [supabase]);

  useEffect(() => {
    fetchBacklog();
  }, [fetchBacklog]);

  useEffect(() => {
    async function fetchAll() {
      const { data } = await supabaseRef.current.from("tasks").select("*");
      setAllTasks((data ?? []) as Task[]);
    }
    fetchAll();
  }, [tasks]); // refetch when day tasks change

  function changeDate(newDate: string) {
    router.push(`/today?date=${newDate}`);
  }

  async function handleUnschedule(task: Task) {
    if (!task.google_event_id) return;
    try {
      await fetch(`/api/calendar/events/${task.google_event_id}`, { method: "DELETE" });
      await updateTask(task.id, { google_event_id: null, status: "planned" } as any);
      toast.success("Removed from calendar");
    } catch {
      toast.error("Failed to remove from calendar");
    }
  }

  // Build a map of google_event_id → event start time for scheduled time display
  const eventTimeMap = new Map<string, string>();
  for (const event of calendarEvents) {
    if (!event.allDay && event.start) {
      eventTimeMap.set(event.id, event.start);
    }
  }

  function getScheduledTime(task: Task): string | undefined {
    if (!task.google_event_id) return undefined;
    const start = eventTimeMap.get(task.google_event_id);
    if (!start) return undefined;
    try {
      return format(parseISO(start), "h:mm a");
    } catch {
      return undefined;
    }
  }

  function getScheduledSortKey(task: Task): string {
    if (task.google_event_id) {
      const start = eventTimeMap.get(task.google_event_id);
      if (start) return start;
    }
    return task.due_date ?? "9999";
  }

  const plannedTasks = tasks
    .filter((t) => t.status === "planned" || t.status === "scheduled")
    .sort((a, b) => getScheduledSortKey(a).localeCompare(getScheduledSortKey(b)));
  const doneTasks = tasks.filter((t) => t.status === "done");
  const suggested = getSuggestedTasks(allBacklogTasks, date);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <DateSelector date={date} onChange={changeDate} />

      <div className="mt-6">
        <CreateTaskInline
          day={date}
          onCreate={createTask}
          existingTasks={allTasks}
          calendarEvents={calendarEvents}
          workingHoursStart={settings.working_hours_start}
          workingHoursEnd={settings.working_hours_end}
          dailyBudget={settings.daily_minutes_budget}
          projects={projects}
        />
      </div>

      {plannedTasks.length === 0 && doneTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ListChecks className="h-12 w-12 mb-4" />
          <p>No tasks for this day yet.</p>
          <p className="text-sm">Add a task above or pick from suggestions below.</p>
        </div>
      ) : (
        <>
          {plannedTasks.length > 0 && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                Planned ({plannedTasks.length})
              </h2>
              <div className="space-y-2">
                {plannedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} onUnschedule={handleUnschedule} projects={projects} scheduledTime={getScheduledTime(task)} />
                ))}
              </div>
            </section>
          )}

          {doneTasks.length > 0 && (
            <Collapsible open={doneOpen} onOpenChange={setDoneOpen} className="mt-6">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-muted-foreground">
                  Done ({doneTasks.length})
                  <ChevronDown className={`h-4 w-4 transition-transform ${doneOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {doneTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} onUnschedule={handleUnschedule} projects={projects} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      <SuggestedTasks tasks={suggested} date={date} onAdd={assignToDay} />
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading...</div>}>
      <TodayContent />
    </Suspense>
  );
}
