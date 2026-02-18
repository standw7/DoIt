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
  created_at: string;
  updated_at: string;
}

export interface ProjectWithProgress extends Project {
  progress: number;
  task_count: number;
  done_count: number;
}

export type TaskInsert = Omit<Task, "id" | "user_id" | "created_at" | "updated_at">;
export type TaskUpdate = Partial<TaskInsert>;
export type ProjectInsert = Omit<Project, "id" | "user_id" | "created_at" | "updated_at">;
export type ProjectUpdate = Partial<ProjectInsert>;
