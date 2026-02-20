"use client";

import { useEffect, useState, useCallback } from "react";
import * as api from "@/lib/api";
import { RecurringTask, RecurringTaskInsert, RecurringTaskUpdate } from "@/lib/types";
import { toast } from "sonner";

export function useRecurringTasks() {
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecurringTasks = useCallback(async () => {
    try {
      const data = await api.getRecurringTasks();
      setRecurringTasks(data);
    } catch {
      toast.error("Failed to load recurring tasks");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecurringTasks();
  }, [fetchRecurringTasks]);

  async function createRecurringTask(task: RecurringTaskInsert) {
    try {
      await api.createRecurringTask(task);
      await fetchRecurringTasks();
    } catch {
      toast.error("Failed to create recurring task");
    }
  }

  async function updateRecurringTask(id: string, updates: RecurringTaskUpdate) {
    const prev = recurringTasks;
    setRecurringTasks((t) => t.map((task) => task.id === id ? { ...task, ...updates } : task));
    try {
      await api.updateRecurringTask(id, updates);
    } catch {
      setRecurringTasks(prev);
      toast.error("Failed to update recurring task");
    }
  }

  async function deleteRecurringTask(id: string) {
    const prev = recurringTasks;
    setRecurringTasks((t) => t.filter((task) => task.id !== id));
    try {
      await api.deleteRecurringTask(id);
    } catch {
      setRecurringTasks(prev);
      toast.error("Failed to delete recurring task");
    }
  }

  return {
    recurringTasks,
    loading,
    createRecurringTask,
    updateRecurringTask,
    deleteRecurringTask,
    refetch: fetchRecurringTasks,
  };
}
