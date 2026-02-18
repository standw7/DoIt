"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskInsert, TaskUpdate } from "@/lib/types";

interface UseTasksOptions {
  projectId?: string;
  day?: string;
}

export function useTasks(options: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchTasks = useCallback(async () => {
    let query = supabase.from("tasks").select("*");

    if (options.projectId) {
      query = query.eq("project_id", options.projectId);
    }
    if (options.day) {
      query = query.eq("day", options.day);
    }

    query = query.order("sort_order").order("created_at");

    const { data } = await query;
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }, [supabase, options.projectId, options.day]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel(`tasks-${options.projectId ?? options.day ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks, supabase, options.projectId, options.day]);

  async function createTask(task: TaskInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("tasks").insert({
      ...task,
      user_id: user.id,
    });
    if (error) throw error;
    await fetchTasks();
  }

  async function updateTask(id: string, updates: TaskUpdate) {
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) throw error;
    await fetchTasks();
  }

  async function deleteTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    await fetchTasks();
  }

  async function toggleDone(task: Task) {
    const newStatus = task.status === "done" ? (task.day ? "planned" : "backlog") : "done";
    await updateTask(task.id, { status: newStatus });
  }

  async function assignToDay(taskId: string, day: string) {
    await updateTask(taskId, { day, status: "planned" });
  }

  return { tasks, loading, createTask, updateTask, deleteTask, toggleDone, assignToDay };
}
