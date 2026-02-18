"use client";

import { use } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { TaskCard } from "@/components/tasks/task-card";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";
import { ProgressBar } from "@/components/projects/progress-bar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { tasks, loading, createTask, updateTask, deleteTask, toggleDone } = useTasks({ projectId: id });
  const { projects } = useProjects();

  const project = projects.find((p) => p.id === id);

  const backlogTasks = tasks.filter((t) => t.status === "backlog");
  const plannedTasks = tasks.filter((t) => t.status === "planned" || t.status === "scheduled");
  const doneTasks = tasks.filter((t) => t.status === "done");

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

      <CreateTaskInline projectId={id} onCreate={createTask} />

      {backlogTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Backlog ({backlogTasks.length})</h2>
          <div className="space-y-2">
            {backlogTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
            ))}
          </div>
        </section>
      )}

      {plannedTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Planned ({plannedTasks.length})</h2>
          <div className="space-y-2">
            {plannedTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
            ))}
          </div>
        </section>
      )}

      {doneTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Done ({doneTasks.length})</h2>
          <div className="space-y-2">
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
