import { Task, CalendarEvent } from "./types";
import { format, addDays, parseISO, differenceInCalendarDays, differenceInMinutes } from "date-fns";

interface SchedulerInput {
  task: { estimated_minutes: number; due_date: string | null; priority: "low" | "medium" | "high"; available_from?: string | null };
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  skipWeekends?: boolean;
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

/**
 * Get the task-minutes already committed to a given day.
 */
function getDayTaskMinutes(dateStr: string, existingTasks: Task[]): number {
  return existingTasks
    .filter((t) => t.day === dateStr && t.status !== "done" && t.status !== "skipped")
    .reduce((sum, t) => sum + (t.estimated_minutes ?? 30), 0);
}

/**
 * Get the calendar-event minutes occupying a given day.
 */
function getDayEventMinutes(dateStr: string, calendarEvents: CalendarEvent[]): number {
  return calendarEvents
    .filter((e) => e.start.startsWith(dateStr) && !e.allDay)
    .reduce((sum, e) => sum + Math.abs(differenceInMinutes(parseISO(e.end), parseISO(e.start))), 0);
}

/**
 * Core scheduling algorithm.
 *
 * Rules:
 * 1. Daily budget is a HARD LIMIT — never place a task on a day that would
 *    push task-minutes over the budget.
 * 2. Exception: if the task is due on a specific day AND no under-budget day
 *    exists before the due date, allow over-budget on the due day itself.
 * 3. Among under-budget days, prefer the one with the LOWEST current load
 *    (even spreading). Ties broken by which day is closest to the midpoint
 *    of the available window (spread tasks out, not front- or back-loaded).
 */
export function scoreDays(input: SchedulerInput): DayScore[] {
  const {
    task,
    existingTasks,
    calendarEvents,
    workingHoursStart,
    workingHoursEnd,
    dailyBudget,
    skipWeekends = false,
  } = input;

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const workMinutes = getWorkingMinutes(workingHoursStart, workingHoursEnd);

  // Determine the candidate window: today through due date (or 14 days out)
  let endDate: Date;
  if (task.due_date) {
    endDate = parseISO(task.due_date);
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

    // Skip weekends if setting is enabled
    const dayOfWeek = candidateDate.getDay();
    if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      continue;
    }

    // Skip days before the task becomes available
    if (task.available_from && dateStr < task.available_from) {
      continue;
    }

    // Calculate available time
    const eventMinutes = getDayEventMinutes(dateStr, calendarEvents);
    const taskMinutes = getDayTaskMinutes(dateStr, existingTasks);

    const totalWorkAvailable = isToday
      ? Math.min(workMinutes, getRemainingWorkMinutesToday(workingHoursEnd))
      : workMinutes;
    const freeMinutes = Math.max(0, totalWorkAvailable - eventMinutes - taskMinutes);

    // Skip if the task physically doesn't fit in working hours
    if (task.estimated_minutes > freeMinutes) {
      continue;
    }

    const taskMinutesAfter = taskMinutes + task.estimated_minutes;
    const withinBudget = taskMinutesAfter <= dailyBudget;
    const isDueDay = task.due_date ? dateStr === task.due_date : false;

    // --- Budget score: hard gate ---
    // Under budget: base 100, bonus for having MORE remaining room (even spread)
    // Over budget: -1000 (effectively eliminated unless it's the due-day fallback)
    let budgetScore: number;
    if (withinBudget) {
      // Prefer days with the most remaining budget room → even spread
      const remainingBudget = dailyBudget - taskMinutesAfter;
      budgetScore = 100 + (remainingBudget / Math.max(dailyBudget, 1)) * 50;
    } else {
      // Over budget — only viable as a last resort on the due day
      budgetScore = isDueDay ? -100 : -1000;
    }

    // --- Spread score: prefer the middle of the window for even distribution ---
    let spreadScore: number;
    if (totalDays <= 1) {
      spreadScore = 100;
    } else {
      // Prefer days with the lowest existing load (most room = best for spreading)
      const loadRatio = taskMinutes / Math.max(dailyBudget, 1);
      spreadScore = 100 * (1 - loadRatio);
    }

    // --- Due date urgency: mild tiebreaker to prefer earlier when due soon ---
    let urgencyScore = 50;
    if (task.due_date) {
      const daysUntilDue = differenceInCalendarDays(parseISO(task.due_date), candidateDate);
      if (daysUntilDue <= 0) urgencyScore = 100;
      else if (daysUntilDue <= 2) urgencyScore = 80;
      else if (daysUntilDue <= 5) urgencyScore = 60;
      else urgencyScore = 40;
    }

    // --- Priority: high priority gets a slight nudge earlier ---
    let priorityScore = 50;
    if (task.priority === "high") {
      priorityScore = totalDays > 1 ? 80 - (i / (totalDays - 1)) * 30 : 80;
    } else if (task.priority === "low") {
      priorityScore = 40;
    }

    // Weights: budget dominates (hard gate), then spread, then urgency/priority as tiebreakers
    const total =
      budgetScore * 0.50 +
      spreadScore * 0.25 +
      urgencyScore * 0.15 +
      priorityScore * 0.10;

    scores.push({
      date: dateStr,
      score: total,
      breakdown: { budget: budgetScore, spread: spreadScore, capacity: urgencyScore, urgency: priorityScore },
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
    // Prefer the first under-budget day
    const underBudget = scores.filter((s) => s.breakdown.budget >= 0);
    if (underBudget.length > 0) {
      return { date: underBudget[0].date, overBudget: false };
    }
    // All days are over budget — pick the best (least over) which is the due day
    return { date: scores[0].date, overBudget: true };
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
  const eventMinutes = getDayEventMinutes(date, events);
  const taskMinutes = getDayTaskMinutes(date, tasks);

  return {
    date,
    totalMinutes: workMinutes,
    eventMinutes,
    taskMinutes,
    freeMinutes: Math.max(0, workMinutes - eventMinutes - taskMinutes),
  };
}

/**
 * Rebalance all auto-assigned planned tasks for optimal spread.
 *
 * 1. Separate tasks into "fixed" (manually assigned or done/skipped) and
 *    "auto" (auto_assigned + planned).
 * 2. Re-run the scheduler for each auto task in due-date order,
 *    incrementally building the schedule from only fixed tasks.
 * 3. Return the list of tasks whose assigned day changed.
 */
export function rebalanceAutoAssigned(input: {
  tasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  skipWeekends?: boolean;
}): { id: string; newDay: string }[] {
  const { tasks, calendarEvents, workingHoursStart, workingHoursEnd, dailyBudget, skipWeekends } = input;

  const autoTasks = tasks.filter(
    (t) => t.auto_assigned && t.status === "planned" && t.day
  );

  if (autoTasks.length === 0) return [];

  const fixedTasks = tasks.filter(
    (t) => !(t.auto_assigned && t.status === "planned" && t.day)
  );

  // Sort by due date (earliest first = highest scheduling priority)
  const sorted = [...autoTasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  const changes: { id: string; newDay: string }[] = [];
  let currentTasks = [...fixedTasks];

  for (const task of sorted) {
    const bestDay = pickBestDay({
      task: {
        estimated_minutes: task.estimated_minutes ?? 30,
        due_date: task.due_date,
        priority: task.priority,
        available_from: task.available_from,
      },
      existingTasks: currentTasks,
      calendarEvents,
      workingHoursStart,
      workingHoursEnd,
      dailyBudget,
      skipWeekends,
    });

    if (bestDay !== task.day) {
      changes.push({ id: task.id, newDay: bestDay });
    }

    // Add this task with its new assignment so subsequent tasks see it
    currentTasks.push({ ...task, day: bestDay });
  }

  return changes;
}
