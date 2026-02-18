"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Project, ProjectWithProgress, ProjectInsert, Task } from "@/lib/types";
import { calculateProgress } from "@/lib/utils";

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (!projectData) {
      setLoading(false);
      return;
    }

    const { data: taskData } = await supabase
      .from("tasks")
      .select("id, project_id, status, estimated_minutes")
      .not("project_id", "is", null);

    const tasks = (taskData ?? []) as Pick<Task, "id" | "project_id" | "status" | "estimated_minutes">[];

    const withProgress: ProjectWithProgress[] = projectData.map((p: Project) => {
      const projectTasks = tasks.filter((t) => t.project_id === p.id) as Task[];
      return {
        ...p,
        progress: calculateProgress(projectTasks),
        task_count: projectTasks.length,
        done_count: projectTasks.filter((t) => t.status === "done").length,
      };
    });

    setProjects(withProgress);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel("projects-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchProjects())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchProjects())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchProjects, supabase]);

  async function createProject(project: ProjectInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("projects").insert({
      ...project,
      user_id: user.id,
    });
    if (error) throw error;
  }

  async function updateProject(id: string, updates: Partial<ProjectInsert>) {
    const { error } = await supabase.from("projects").update(updates).eq("id", id);
    if (error) throw error;
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  }

  return { projects, loading, createProject, updateProject, deleteProject };
}
