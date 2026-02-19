"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { RecurringTask, Task } from "@/lib/types";
import { getInstancesNeeded } from "@/lib/recurring";

/**
 * Auto-generates task instances from recurring task templates.
 * Runs once on mount and whenever templates or tasks change.
 */
export function useRecurringGeneration(
  recurringTasks: RecurringTask[],
  allTasks: Task[] | null,
  onTasksGenerated?: () => void
) {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const generatingRef = useRef(false);

  const generate = useCallback(async () => {
    if (generatingRef.current) return;
    if (recurringTasks.length === 0) return;
    if (allTasks === null) return; // Wait until tasks have been loaded

    const needed = getInstancesNeeded(recurringTasks, allTasks);
    if (needed.length === 0) return;

    generatingRef.current = true;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      generatingRef.current = false;
      return;
    }

    for (const { template, dueDate, day } of needed) {
      await supabase.from("tasks").insert({
        user_id: user.id,
        name: template.name,
        description: template.description,
        estimated_minutes: template.estimated_minutes,
        priority: template.priority,
        project_id: template.project_id,
        due_date: dueDate,
        day: day,
        status: "planned",
        sort_order: 0,
        split_allowed: false,
        tags: null,
        auto_assigned: true,
        recurring_task_id: template.id,
      });
    }

    generatingRef.current = false;
    onTasksGenerated?.();
  }, [recurringTasks, allTasks, supabase, onTasksGenerated]);

  useEffect(() => {
    generate();
  }, [generate]);
}
