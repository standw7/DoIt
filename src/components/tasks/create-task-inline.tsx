"use client";

import { CreateTaskDialog } from "./create-task-dialog";
import { TaskInsert, Task, CalendarEvent, RecurringTaskInsert } from "@/lib/types";

interface ProjectOption {
  id: string;
  name: string;
}

interface CreateTaskInlineProps {
  projectId?: string;
  day?: string;
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  onCreate: (task: TaskInsert) => Promise<void>;
  onCreateRecurring?: (task: RecurringTaskInsert) => Promise<void>;
  projects?: ProjectOption[];
}

export function CreateTaskInline(props: CreateTaskInlineProps) {
  return <CreateTaskDialog {...props} />;
}
