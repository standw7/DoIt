import { Task, CalendarEvent } from "./types";
import { format, addDays, parseISO, differenceInCalendarDays, differenceInMinutes } from "date-fns";

interface SchedulerInput {
  task: { estimated_minutes: number; due_date: string | null; priority: "low" | "medium" | "high" };
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

  // Determine the candidate window: today through day before due date (or 14 days out)
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

    // --- Budget score (0-100): prefer days where adding this task stays near the daily budget ---
    const taskMinutesAfter = taskMinutes + task.estimated_minutes;
    let budgetScore: number;
    if (taskMinutesAfter <= dailyBudget) {
      // Under or at budget — good. Prefer filling toward the budget (80-100).
      budgetScore = 80 + (taskMinutesAfter / dailyBudget) * 20;
    } else {
      // Over budget — penalize proportionally
      const overBy = taskMinutesAfter - dailyBudget;
      budgetScore = Math.max(0, 70 - (overBy / dailyBudget) * 70);
    }

    // --- Spread score (0-100): prefer earlier days to spread work out ---
    let spreadScore: number;
    if (totalDays <= 1) {
      spreadScore = 50;
    } else {
      // Earlier days score higher — avoid cramming near deadline
      spreadScore = 90 - (i / (totalDays - 1)) * 60;
      // Bonus for days with fewer tasks (encourages even distribution)
      if (dayTasks.length === 0) spreadScore += 10;
      spreadScore = Math.min(100, spreadScore);
    }

    // --- Urgency score (0-100): high priority tasks go sooner ---
    let urgencyScore = 50;
    if (task.priority === "high") {
      urgencyScore = totalDays > 1 ? 100 - (i / (totalDays - 1)) * 60 : 100;
    } else if (task.priority === "low") {
      urgencyScore = totalDays > 1 ? 30 + (i / (totalDays - 1)) * 40 : 50;
    }

    const total =
      budgetScore * 0.45 +
      spreadScore * 0.35 +
      urgencyScore * 0.20;

    scores.push({
      date: dateStr,
      score: total,
      breakdown: { budget: budgetScore, spread: spreadScore, urgency: urgencyScore },
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

export function pickBestDay(input: SchedulerInput): string {
  const scores = scoreDays(input);
  if (scores.length === 0) {
    return format(new Date(), "yyyy-MM-dd");
  }
  return scores[0].date;
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
