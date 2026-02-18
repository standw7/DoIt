"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { RecurringTask, RecurringTaskInsert, RecurringTaskUpdate } from "@/lib/types";
import { toast } from "sonner";

export function useRecurringTasks() {
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchRecurringTasks = useCallback(async () => {
    const { data } = await supabase
      .from("recurring_tasks")
      .select("*")
      .order("recurrence_day")
      .order("name");

    setRecurringTasks((data ?? []) as RecurringTask[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchRecurringTasks();
  }, [fetchRecurringTasks]);

  async function createRecurringTask(task: RecurringTaskInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("recurring_tasks").insert({
      ...task,
      user_id: user.id,
    });
    if (error) throw error;
    await fetchRecurringTasks();
  }

  async function updateRecurringTask(id: string, updates: RecurringTaskUpdate) {
    const prev = recurringTasks;
    setRecurringTasks((t) => t.map((task) => task.id === id ? { ...task, ...updates } : task));
    try {
      const { error } = await supabase.from("recurring_tasks").update(updates).eq("id", id);
      if (error) throw error;
    } catch {
      setRecurringTasks(prev);
      toast.error("Failed to update recurring task");
    }
  }

  async function deleteRecurringTask(id: string) {
    const prev = recurringTasks;
    setRecurringTasks((t) => t.filter((task) => task.id !== id));
    try {
      const { error } = await supabase.from("recurring_tasks").delete().eq("id", id);
      if (error) throw error;
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
