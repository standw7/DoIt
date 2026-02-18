"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { RecurringTask, RecurringTaskInsert, RecurringTaskUpdate } from "@/lib/types";

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
    const { error } = await supabase
      .from("recurring_tasks")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
    await fetchRecurringTasks();
  }

  async function deleteRecurringTask(id: string) {
    const { error } = await supabase
      .from("recurring_tasks")
      .delete()
      .eq("id", id);
    if (error) throw error;
    await fetchRecurringTasks();
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
