"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTasks } from "@/hooks/use-tasks";
import { Task } from "@/lib/types";
import { DateSelector } from "@/components/daily/date-selector";
import { SuggestedTasks } from "@/components/daily/suggested-tasks";
import { TaskCard } from "@/components/tasks/task-card";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ListChecks } from "lucide-react";
import { todayString, getSuggestedTasks } from "@/lib/utils";

function TodayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? todayString();
  const [allBacklogTasks, setAllBacklogTasks] = useState<Task[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);
  const supabase = createClient();

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

  function changeDate(newDate: string) {
    router.push(`/today?date=${newDate}`);
  }

  const plannedTasks = tasks.filter((t) => t.status === "planned" || t.status === "scheduled");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const suggested = getSuggestedTasks(allBacklogTasks, date);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <DateSelector date={date} onChange={changeDate} />

      <div className="mt-6">
        <CreateTaskInline day={date} onCreate={createTask} />
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
                  <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
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
                  <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
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
