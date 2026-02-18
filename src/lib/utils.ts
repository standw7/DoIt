import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Task } from "./types";
import { format, parseISO, addDays, isBefore, isEqual } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateProgress(tasks: Task[]): number {
  if (tasks.length === 0) return 0;

  const hasEstimates = tasks.some((t) => t.estimated_minutes != null);

  if (hasEstimates) {
    const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
    if (totalMinutes === 0) return 0;
    const doneMinutes = tasks
      .filter((t) => t.status === "done")
      .reduce((sum, t) => sum + (t.estimated_minutes ?? 0), 0);
    return doneMinutes / totalMinutes;
  }

  return tasks.filter((t) => t.status === "done").length / tasks.length;
}

export function getSuggestedTasks(tasks: Task[], date: string, limit = 7): Task[] {
  const targetDate = parseISO(date);

  const backlogTasks = tasks.filter((t) => t.status === "backlog" && !t.day);

  const scored = backlogTasks.map((task) => {
    let score = 0;
    if (task.due_date) {
      const due = parseISO(task.due_date);
      if (isBefore(due, targetDate)) score += 100;
      else if (isEqual(due, targetDate)) score += 80;
      else if (isBefore(due, addDays(targetDate, 4))) score += 60;
    }
    if (task.priority === "high") score += 40;
    else if (task.priority === "medium") score += 20;
    return { task, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.task);
}

export function formatDate(date: string): string {
  return format(parseISO(date), "EEEE, MMMM d");
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function todayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}
