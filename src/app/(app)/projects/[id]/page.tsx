"use client";

import { use, useState, useEffect } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useSettings } from "@/hooks/use-settings";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useRecurringTasks } from "@/hooks/use-recurring-tasks";
import { TaskCard } from "@/components/tasks/task-card";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";
import { RecurringTasksSection } from "@/components/settings/recurring-tasks-section";
import { ProgressBar } from "@/components/projects/progress-bar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Task } from "@/lib/types";
import * as api from "@/lib/api";
import { format, addDays } from "date-fns";
import { rebalanceAutoAssigned } from "@/lib/scheduler";
import { toast } from "sonner";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { tasks, loading, createTask, updateTask, deleteTask, toggleDone } = useTasks({ projectId: id });
  const { projects } = useProjects();
  const { settings } = useSettings();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const futureStr = format(addDays(new Date(), 14), "yyyy-MM-dd");
  const { events: calendarEvents } = useCalendarEvents(todayStr, futureStr);
  const {
    recurringTasks,
    createRecurringTask,
    updateRecurringTask,
    deleteRecurringTask,
  } = useRecurringTasks();

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const data = await api.getTasks();
        setAllTasks(data);
      } catch {
        // ignore
      }
    }
    fetchAll();
  }, [tasks]); // refetch when project tasks change

  const project = projects.find((p) => p.id === id);

  // Filter recurring tasks to this project
  const projectRecurringTasks = recurringTasks.filter((rt) => rt.project_id === id);

  async function handleCreateTask(task: any) {
    await createTask(task);
    try {
      const freshTasks = await api.getTasks();
      const changes = rebalanceAutoAssigned({
        tasks: freshTasks,
        calendarEvents,
        workingHoursStart: settings.working_hours_start,
        workingHoursEnd: settings.working_hours_end,
        dailyBudget: settings.daily_minutes_budget,
        skipWeekends: settings.skip_weekends,
      });
      for (const { id: taskId, newDay } of changes) {
        await api.updateTask(taskId, { day: newDay });
      }
    } catch {
      // rebalance failure is non-critical
    }
  }

  async function handleUnschedule(task: Task) {
    if (!task.google_event_id) return;
    try {
      await api.deleteCalendarEvent(task.google_event_id);
      await updateTask(task.id, { google_event_id: null, status: "planned" } as any);
      toast.success("Removed from calendar");
    } catch {
      toast.error("Failed to remove from calendar");
    }
  }

  // Split tasks into one-time and recurring instances
  const oneTimeTasks = tasks.filter((t) => !t.recurring_task_id);
  const recurringInstances = tasks.filter((t) => t.recurring_task_id);

  // One-time task sections
  const backlogTasks = oneTimeTasks
    .filter((t) => t.status === "backlog")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const plannedTasks = oneTimeTasks
    .filter((t) => t.status === "planned" || t.status === "scheduled")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const doneTasks = oneTimeTasks.filter((t) => t.status === "done");

  // Recurring instance sections
  const recurringPlanned = recurringInstances
    .filter((t) => t.status === "planned" || t.status === "scheduled")
    .sort((a, b) => (a.day ?? "9999").localeCompare(b.day ?? "9999"));
  const recurringDone = recurringInstances.filter((t) => t.status === "done");

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/projects">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Projects
        </Button>
      </Link>

      <h1 className="text-2xl font-bold">{project?.name ?? "Project"}</h1>
      {project?.goal && <p className="text-muted-foreground mt-1">{project.goal}</p>}
      {project && <ProgressBar progress={project.progress} className="mt-4 mb-6" />}

      <CreateTaskInline
        projectId={id}
        onCreate={handleCreateTask}
        onCreateRecurring={createRecurringTask}
        existingTasks={allTasks}
        calendarEvents={calendarEvents}
        workingHoursStart={settings.working_hours_start}
        workingHoursEnd={settings.working_hours_end}
        dailyBudget={settings.daily_minutes_budget}
        skipWeekends={settings.skip_weekends}
      />

      {/* One-time tasks */}
      {backlogTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Backlog ({backlogTasks.length})</h2>
          <div className="space-y-2">
            {backlogTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} onUnschedule={handleUnschedule} projects={projects} />
            ))}
          </div>
        </section>
      )}

      {plannedTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Planned ({plannedTasks.length})</h2>
          <div className="space-y-2">
            {plannedTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} onUnschedule={handleUnschedule} projects={projects} />
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

      {/* Recurring tasks section — templates + upcoming instances */}
      {(projectRecurringTasks.length > 0 || recurringPlanned.length > 0) && (
        <div className="mt-8">
          <RecurringTasksSection
            recurringTasks={projectRecurringTasks}
            onCreate={createRecurringTask}
            onUpdate={updateRecurringTask}
            onDelete={deleteRecurringTask}
          />

          {recurringPlanned.length > 0 && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                Upcoming recurring ({recurringPlanned.length})
              </h2>
              <div className="space-y-2">
                {recurringPlanned.map((task) => (
                  <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} onUnschedule={handleUnschedule} projects={projects} />
                ))}
              </div>
            </section>
          )}

          {recurringDone.length > 0 && (
            <Collapsible className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-muted-foreground">
                  Recurring done ({recurringDone.length})
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {recurringDone.map((task) => (
                  <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} onUnschedule={handleUnschedule} projects={projects} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
