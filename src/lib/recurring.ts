import { RecurringTask, Task } from "./types";
import { format, addDays, parseISO, getDay, nextDay, isBefore, isAfter, isEqual } from "date-fns";

/**
 * Finds which recurring task instances need to be created.
 * Looks 2 weeks ahead and checks if a task instance already exists.
 */
export function getInstancesNeeded(
  templates: RecurringTask[],
  existingTasks: Task[],
  weeksAhead = 2
): { template: RecurringTask; dueDate: string; day: string }[] {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const horizon = addDays(today, weeksAhead * 7);
  const needed: { template: RecurringTask; dueDate: string; day: string }[] = [];

  for (const template of templates) {
    if (!template.active) continue;

    const startDate = parseISO(template.start_date);
    const endDate = template.end_date ? parseISO(template.end_date) : null;

    // Find all occurrence dates within the window
    // Start from today (or start_date if in the future)
    let cursor = isBefore(startDate, today) ? today : startDate;

    // Find the next occurrence of the recurrence day from cursor
    const targetDay = template.recurrence_day as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    if (getDay(cursor) !== targetDay) {
      cursor = nextDay(cursor, targetDay);
    }

    while (!isAfter(cursor, horizon)) {
      // Check end date
      if (endDate && isAfter(cursor, endDate)) break;

      // Check start date
      if (!isBefore(cursor, startDate) || isEqual(cursor, startDate)) {
        const dateStr = format(cursor, "yyyy-MM-dd");

        // Check if instance already exists for this template + date
        const alreadyExists = existingTasks.some(
          (t) =>
            t.recurring_task_id === template.id &&
            t.due_date === dateStr
        );

        if (!alreadyExists) {
          needed.push({
            template,
            dueDate: dateStr,
            day: dateStr, // Due date and scheduled day are the same for recurring tasks
          });
        }
      }

      cursor = addDays(cursor, 7);
    }
  }

  return needed;
}
