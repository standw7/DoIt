import type {
  Task,
  TaskInsert,
  TaskUpdate,
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectWithProgress,
  RecurringTask,
  RecurringTaskInsert,
  RecurringTaskUpdate,
  UserSettings,
  UserSettingsUpdate,
  CalendarEvent,
} from "./types";

const BASE_URL = "/api/backend";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("doit_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs: number = 55000,
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw { error: "Timeout", detail: "Request timed out. Please try again.", statusCode: 0 };
    }
    throw { error: "Network error", detail: "Could not reach the server. Please try again.", statusCode: 0 };
  } finally {
    clearTimeout(timer);
  }

  // 204 No Content — return empty
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw {
      error: body.error ?? "Request failed",
      detail: body.detail ?? res.statusText,
      statusCode: res.status,
    };
  }

  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────

export async function signup(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
  return request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getCurrentUser(): Promise<{ id: string; email: string; created_at: string; updated_at: string }> {
  return request("/auth/me");
}

// ── Tasks ────────────────────────────────────────────────────

export async function getTasks(params?: {
  day?: string;
  project_id?: string;
  status?: string;
}): Promise<Task[]> {
  const qs = new URLSearchParams();
  if (params?.day) qs.set("day", params.day);
  if (params?.project_id) qs.set("project_id", params.project_id);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString();
  return request(`/tasks/${query ? `?${query}` : ""}`);
}

export async function createTask(task: TaskInsert): Promise<Task> {
  return request("/tasks/", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

export async function updateTask(id: string, updates: TaskUpdate): Promise<Task> {
  return request(`/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(id: string): Promise<void> {
  return request(`/tasks/${id}`, { method: "DELETE" });
}

// ── Projects ─────────────────────────────────────────────────

export async function getProjects(): Promise<ProjectWithProgress[]> {
  return request("/projects/");
}

export async function createProject(project: ProjectInsert): Promise<Project> {
  return request("/projects/", {
    method: "POST",
    body: JSON.stringify(project),
  });
}

export async function updateProject(id: string, updates: ProjectUpdate): Promise<Project> {
  return request(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteProject(id: string): Promise<void> {
  return request(`/projects/${id}`, { method: "DELETE" });
}

// ── Recurring Tasks ──────────────────────────────────────────

export async function getRecurringTasks(): Promise<RecurringTask[]> {
  return request("/recurring-tasks/");
}

export async function createRecurringTask(task: RecurringTaskInsert): Promise<RecurringTask> {
  return request("/recurring-tasks/", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

export async function updateRecurringTask(id: string, updates: RecurringTaskUpdate): Promise<RecurringTask> {
  return request(`/recurring-tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteRecurringTask(id: string): Promise<void> {
  return request(`/recurring-tasks/${id}`, { method: "DELETE" });
}

export async function generateRecurringInstances(): Promise<Task[]> {
  return request("/recurring-tasks/generate", { method: "POST" });
}

// ── Settings ─────────────────────────────────────────────────

export async function getSettings(): Promise<UserSettings> {
  return request("/settings/");
}

export async function updateSettings(updates: UserSettingsUpdate): Promise<UserSettings> {
  return request("/settings/", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

// ── Calendar ─────────────────────────────────────────────────

export async function getCalendarEvents(start: string, end: string): Promise<CalendarEvent[]> {
  return request(`/calendar/events?start=${start}&end=${end}`);
}

export async function createCalendarEvent(event: {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  taskId?: string;
}): Promise<{ eventId: string }> {
  return request("/calendar/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export async function updateCalendarEvent(eventId: string, updates: {
  startDateTime?: string;
  endDateTime?: string;
}): Promise<void> {
  return request(`/calendar/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  return request(`/calendar/events/${eventId}`, { method: "DELETE" });
}

export async function setupCalendar(): Promise<{ calendarId: string }> {
  return request("/calendar/setup", { method: "POST" });
}

export async function getGoogleAuthUrl(): Promise<{ url: string }> {
  return request("/auth/google");
}

export async function exchangeGoogleCode(code: string): Promise<void> {
  return request("/auth/google/callback", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function disconnectGoogle(): Promise<void> {
  return request("/auth/google", { method: "DELETE" });
}
