"use client";

import { useEffect, useRef, useCallback } from "react";
import * as api from "@/lib/api";
import { RecurringTask, Task } from "@/lib/types";

/**
 * Auto-generates task instances from recurring task templates.
 * Calls the backend POST /recurring-tasks/generate endpoint.
 * Runs once on mount and whenever templates change.
 */
export function useRecurringGeneration(
  recurringTasks: RecurringTask[],
  allTasks: Task[] | null,
  onTasksGenerated?: () => void
) {
  const generatingRef = useRef(false);

  const generate = useCallback(async () => {
    if (generatingRef.current) return;
    if (recurringTasks.length === 0) return;
    if (allTasks === null) return;

    generatingRef.current = true;

    try {
      const created = await api.generateRecurringInstances();
      if (created.length > 0) {
        onTasksGenerated?.();
      }
    } catch {
      // Silently fail — generation will retry next mount
    }

    generatingRef.current = false;
  }, [recurringTasks, allTasks, onTasksGenerated]);

  useEffect(() => {
    generate();
  }, [generate]);
}
