import { Task, CalendarEvent } from "./types";
import { format, addDays, parseISO, differenceInCalendarDays, differenceInMinutes } from "date-fns";

interface SchedulerInput {
  task: { estimated_minutes: number; due_date: string | null; priority: "low" | "medium" | "high"; available_from?: string | null };
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
}

interface DayScore {
  date: string;
  score: number;
  breakdown: {
    budget: number;
    spread: number;
    capacity: number;
    urgency: number;
  };
}

export function getWorkingMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function getRemainingWorkMinutesToday(workEnd: string): number {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [eh, em] = workEnd.split(":").map(Number);
  const endMin = eh * 60 + em;
  return Math.max(0, endMin - nowMin);
}

export function scoreDays(input: SchedulerInput): DayScore[] {
  const {
    task,
    existingTasks,
    calendarEvents,
    workingHoursStart,
    workingHoursEnd,
    dailyBudget,
  } = input;

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const workMinutes = getWorkingMinutes(workingHoursStart, workingHoursEnd);

  // Determine the candidate window: today through due date (or 14 days out)
  let endDate: Date;
  if (task.due_date) {
    endDate = parseISO(task.due_date);
    // If due today or in the past, only option is today
    if (format(endDate, "yyyy-MM-dd") <= todayStr) {
      endDate = today;
    }
  } else {
    endDate = addDays(today, 14);
  }

  const totalDays = differenceInCalendarDays(endDate, today) + 1;
  const scores: DayScore[] = [];

  for (let i = 0; i < totalDays; i++) {
    const candidateDate = addDays(today, i);
    const dateStr = format(candidateDate, "yyyy-MM-dd");
    const isToday = dateStr === todayStr;

    // Skip days before the task becomes available
    if (task.available_from && dateStr < task.available_from) {
      continue;
    }

    // Calculate available time
    const dayEvents = calendarEvents.filter((e) => e.start.startsWith(dateStr) && !e.allDay);
    const eventMinutes = dayEvents.reduce((sum, e) => {
      return sum + Math.abs(differenceInMinutes(parseISO(e.end), parseISO(e.start)));
    }, 0);

    const dayTasks = existingTasks.filter((t) => t.day === dateStr && t.status !== "done" && t.status !== "skipped");
    const taskMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 30), 0);

    const totalWorkAvailable = isToday
      ? Math.min(workMinutes, getRemainingWorkMinutesToday(workingHoursEnd))
      : workMinutes;
    const freeMinutes = Math.max(0, totalWorkAvailable - eventMinutes - taskMinutes);

    // Skip if the task physically doesn't fit
    if (task.estimated_minutes > freeMinutes) {
      continue;
    }

    // --- 1) Budget score (weight 0.40): stay at or under daily budget ---
    const taskMinutesAfter = taskMinutes + task.estimated_minutes;
    let budgetScore: number;
    if (taskMinutesAfter <= dailyBudget) {
      // Under or at budget — reward filling toward the limit
      budgetScore = 80 + (taskMinutesAfter / dailyBudget) * 20;
    } else {
      // Over budget — hard penalty so under-budget days always win
      const overBy = taskMinutesAfter - dailyBudget;
      budgetScore = -50 - (overBy / dailyBudget) * 50;
    }

    // --- 2) Due date score (weight 0.25): schedule closer to now when due soon ---
    let dueScore = 50; // default for tasks with no due date
    if (task.due_date) {
      const daysUntilDue = differenceInCalendarDays(parseISO(task.due_date), candidateDate);
      if (daysUntilDue <= 0) {
        dueScore = 100; // due today or overdue
      } else if (daysUntilDue <= 2) {
        dueScore = 90;
      } else if (daysUntilDue <= 5) {
        dueScore = 70;
      } else {
        dueScore = 40;
      }
    }

    // --- 3) Priority score (weight 0.20): high priority → earlier days ---
    let priorityScore = 50;
    if (task.priority === "high") {
      priorityScore = totalDays > 1 ? 100 - (i / (totalDays - 1)) * 40 : 100;
    } else if (task.priority === "low") {
      priorityScore = totalDays > 1 ? 30 + (i / (totalDays - 1)) * 30 : 40;
    } else {
      // medium: mild preference for earlier
      priorityScore = totalDays > 1 ? 70 - (i / (totalDays - 1)) * 30 : 60;
    }

    // --- 4) Earliness score (weight 0.15): fill earlier days first ---
    let earlinessScore: number;
    if (totalDays <= 1) {
      earlinessScore = 100;
    } else {
      earlinessScore = 100 - (i / (totalDays - 1)) * 80;
    }

    const total =
      budgetScore * 0.40 +
      dueScore * 0.25 +
      priorityScore * 0.20 +
      earlinessScore * 0.15;

    scores.push({
      date: dateStr,
      score: total,
      breakdown: { budget: budgetScore, spread: earlinessScore, capacity: dueScore, urgency: priorityScore },
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

export interface PickResult {
  date: string;
  overBudget: boolean;
}

export function pickBestDay(input: SchedulerInput): string {
  const result = pickBestDayWithInfo(input);
  return result.date;
}

export function pickBestDayWithInfo(input: SchedulerInput): PickResult {
  const scores = scoreDays(input);
  if (scores.length > 0) {
    return {
      date: scores[0].date,
      overBudget: scores[0].breakdown.budget < 0,
    };
  }

  // No day has physical capacity — fall back to due date or today
  const fallback = input.task.due_date ?? format(new Date(), "yyyy-MM-dd");
  return { date: fallback, overBudget: true };
}

export function getDayCapacity(
  date: string,
  tasks: Task[],
  events: CalendarEvent[],
  workStart: string,
  workEnd: string
) {
  const workMinutes = getWorkingMinutes(workStart, workEnd);

  const dayEvents = events.filter((e) => e.start.startsWith(date) && !e.allDay);
  const eventMinutes = dayEvents.reduce((sum, e) => {
    return sum + Math.abs(differenceInMinutes(parseISO(e.end), parseISO(e.start)));
  }, 0);

  const dayTasks = tasks.filter((t) => t.day === date && t.status !== "done" && t.status !== "skipped");
  const taskMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 30), 0);

  return {
    date,
    totalMinutes: workMinutes,
    eventMinutes,
    taskMinutes,
    freeMinutes: Math.max(0, workMinutes - eventMinutes - taskMinutes),
  };
}
