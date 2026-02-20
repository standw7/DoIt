"use client";

import { useEffect, useState, useCallback } from "react";
import * as api from "@/lib/api";
import { Task, TaskInsert, TaskUpdate } from "@/lib/types";
import { toast } from "sonner";

interface UseTasksOptions {
  projectId?: string;
  day?: string;
}

export function useTasks(options: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.getTasks({
        project_id: options.projectId,
        day: options.day,
      });
      setTasks(data);
    } catch {
      toast.error("Failed to load tasks");
    }
    setLoading(false);
  }, [options.projectId, options.day]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function createTask(task: TaskInsert) {
    try {
      await api.createTask(task);
      await fetchTasks();
    } catch {
      toast.error("Failed to create task");
    }
  }

  async function updateTask(id: string, updates: TaskUpdate) {
    const prev = tasks;
    setTasks((t) => t.map((task) => task.id === id ? { ...task, ...updates } : task));
    try {
      await api.updateTask(id, updates);
    } catch {
      setTasks(prev);
      toast.error("Failed to update task");
    }
  }

  async function deleteTask(id: string) {
    const prev = tasks;
    setTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.deleteTask(id);
    } catch {
      setTasks(prev);
      toast.error("Failed to delete task");
    }
  }

  async function toggleDone(task: Task) {
    const newStatus = task.status === "done" ? (task.day ? "planned" : "backlog") : "done";
    await updateTask(task.id, { status: newStatus });
  }

  async function assignToDay(taskId: string, day: string) {
    await updateTask(taskId, { day, status: "planned" });
  }

  return { tasks, loading, createTask, updateTask, deleteTask, toggleDone, assignToDay, refetch: fetchTasks };
}
