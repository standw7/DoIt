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
    proximity: number;
    capacity: number;
    balance: number;
    priority: number;
  };
}

const WEIGHTS = {
  proximity: 0.35,
  capacity: 0.30,
  balance: 0.20,
  priority: 0.15,
};

export function getWorkingMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export function scoreDays(input: SchedulerInput): DayScore[] {
  const {
    task,
    existingTasks,
    calendarEvents,
    workingHoursStart,
    workingHoursEnd,
  } = input;

  const today = new Date();
  const tomorrow = addDays(today, 1);

  let endDate: Date;
  if (task.due_date) {
    endDate = addDays(parseISO(task.due_date), -1);
    if (endDate < tomorrow) endDate = tomorrow;
  } else {
    endDate = addDays(today, 14);
  }

  const totalDays = differenceInCalendarDays(endDate, tomorrow) + 1;
  const workMinutes = getWorkingMinutes(workingHoursStart, workingHoursEnd);

  const scores: DayScore[] = [];

  for (let i = 0; i < totalDays; i++) {
    const candidateDate = addDays(tomorrow, i);
    const dateStr = format(candidateDate, "yyyy-MM-dd");

    // Capacity
    const dayEvents = calendarEvents.filter((e) => e.start.startsWith(dateStr) && !e.allDay);
    const eventMinutes = dayEvents.reduce((sum, e) => {
      return sum + Math.abs(differenceInMinutes(parseISO(e.end), parseISO(e.start)));
    }, 0);

    const dayTasks = existingTasks.filter((t) => t.day === dateStr && t.status !== "done" && t.status !== "skipped");
    const taskMinutes = dayTasks.reduce((sum, t) => sum + (t.estimated_minutes ?? 30), 0);

    const freeMinutes = Math.max(0, workMinutes - eventMinutes - taskMinutes);
    const capacityScore = task.estimated_minutes <= freeMinutes
      ? (freeMinutes / workMinutes) * 100
      : 0;

    // Proximity
    let proximityScore = 50;
    if (task.due_date) {
      const daysUntilDue = differenceInCalendarDays(parseISO(task.due_date), tomorrow);
      if (daysUntilDue > 0) {
        proximityScore = 100 - ((daysUntilDue - i) / daysUntilDue) * 100;
      } else {
        proximityScore = 100;
      }
    }

    // Balance
    const longTasks = dayTasks.filter((t) => (t.estimated_minutes ?? 30) >= 45).length;
    const shortTasks = dayTasks.filter((t) => (t.estimated_minutes ?? 30) < 45).length;
    const isLongTask = task.estimated_minutes >= 45;

    let balanceScore = 70;
    if (isLongTask && longTasks >= 2) balanceScore -= 40;
    if (!isLongTask && shortTasks >= 5) balanceScore -= 20;
    if (dayTasks.length === 0) balanceScore = 90;
    if (longTasks <= 1 && isLongTask) balanceScore += 10;
    balanceScore = Math.max(0, Math.min(100, balanceScore));

    // Priority
    let priorityScore = 50;
    if (task.priority === "high") {
      priorityScore = totalDays > 1 ? 100 - (i / (totalDays - 1)) * 80 : 100;
    } else if (task.priority === "low") {
      priorityScore = totalDays > 1 ? 20 + (i / (totalDays - 1)) * 60 : 50;
    }

    const total =
      proximityScore * WEIGHTS.proximity +
      capacityScore * WEIGHTS.capacity +
      balanceScore * WEIGHTS.balance +
      priorityScore * WEIGHTS.priority;

    scores.push({
      date: dateStr,
      score: total,
      breakdown: { proximity: proximityScore, capacity: capacityScore, balance: balanceScore, priority: priorityScore },
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

export function pickBestDay(input: SchedulerInput): string {
  const scores = scoreDays(input);
  if (scores.length === 0) {
    return format(addDays(new Date(), 1), "yyyy-MM-dd");
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
