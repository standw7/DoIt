"use client";

import { CreateTaskDialog } from "./create-task-dialog";
import { TaskInsert, Task, CalendarEvent } from "@/lib/types";

interface CreateTaskInlineProps {
  projectId?: string;
  day?: string;
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  onCreate: (task: TaskInsert) => Promise<void>;
}

export function CreateTaskInline(props: CreateTaskInlineProps) {
  return <CreateTaskDialog {...props} />;
}
