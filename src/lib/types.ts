export type TaskStatus = "backlog" | "planned" | "scheduled" | "done" | "skipped";
export type TaskPriority = "low" | "medium" | "high";

export interface Project {
  id: string;
  user_id: string;
  name: string;
  goal: string | null;
  definition_of_done: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  day: string | null;
  due_date: string | null;
  estimated_minutes: number | null;
  split_allowed: boolean;
  tags: string[] | null;
  sort_order: number;
  google_event_id: string | null;
  auto_assigned: boolean;
  recurring_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithProgress extends Project {
  progress: number;
  task_count: number;
  done_count: number;
}

export type TaskInsert = Omit<Task, "id" | "user_id" | "created_at" | "updated_at" | "google_event_id" | "auto_assigned" | "recurring_task_id"> & {
  google_event_id?: string | null;
  auto_assigned?: boolean;
  recurring_task_id?: string | null;
};
export type TaskUpdate = Partial<TaskInsert>;
export type ProjectInsert = Omit<Project, "id" | "user_id" | "created_at" | "updated_at">;
export type ProjectUpdate = Partial<ProjectInsert>;

export interface UserSettings {
  id: string;
  user_id: string;
  working_hours_start: string;
  working_hours_end: string;
  daily_minutes_budget: number;
  auto_assign_enabled: boolean;
  doit_calendar_id: string | null;
  digest_enabled: boolean;
  digest_city: string | null;
  digest_latitude: number | null;
  digest_longitude: number | null;
  created_at: string;
  updated_at: string;
}

export type UserSettingsInsert = Omit<UserSettings, "id" | "user_id" | "created_at" | "updated_at">;
export type UserSettingsUpdate = Partial<UserSettingsInsert>;

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export interface RecurringTask {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  estimated_minutes: number;
  priority: TaskPriority;
  project_id: string | null;
  recurrence_day: number; // 0=Sunday ... 6=Saturday
  start_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RecurringTaskInsert = Omit<RecurringTask, "id" | "user_id" | "created_at" | "updated_at">;
export type RecurringTaskUpdate = Partial<RecurringTaskInsert>;

export interface DayCapacity {
  date: string;
  totalMinutes: number;
  eventMinutes: number;
  taskMinutes: number;
  freeMinutes: number;
}
