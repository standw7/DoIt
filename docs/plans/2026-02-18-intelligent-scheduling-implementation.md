# Intelligent Scheduling + Calendar Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add expanded task creation with auto-day-assignment, Google Calendar read/write, configurable settings, and a schedule page with timeline view.

**Architecture:** Score-based algorithm assigns tasks to days using calendar events + existing workload. Google Calendar API accessed via Next.js API routes using OAuth tokens stored by Supabase Auth. Dedicated "DoIt Tasks" calendar for write operations.

**Tech Stack:** Next.js 16 API routes, Google Calendar API v3, Supabase Auth (provider tokens), date-fns

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_settings_and_calendar.sql`

**Step 1: Write the migration**

Create `supabase/migrations/002_settings_and_calendar.sql`:

```sql
-- User settings table
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  working_hours_start TIME NOT NULL DEFAULT '09:00',
  working_hours_end TIME NOT NULL DEFAULT '17:00',
  daily_minutes_budget INTEGER NOT NULL DEFAULT 120,
  doit_calendar_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add google_event_id to tasks
ALTER TABLE tasks ADD COLUMN google_event_id TEXT;

-- Add auto_assigned to tasks (for "auto" badge on daily list)
ALTER TABLE tasks ADD COLUMN auto_assigned BOOLEAN NOT NULL DEFAULT false;

-- Enable realtime on settings
ALTER PUBLICATION supabase_realtime ADD TABLE user_settings;
```

**Step 2: User runs migration in Supabase SQL Editor**

Instruct user to copy/paste and run in Supabase Dashboard → SQL Editor.

**Step 3: Commit**

```bash
git add supabase/migrations/002_settings_and_calendar.sql
git commit -m "feat: add user_settings table and google_event_id to tasks"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add new types**

Add `google_event_id` and `auto_assigned` to the Task interface. Add UserSettings interface. Update TaskInsert to include new fields.

```typescript
// Add to Task interface after sort_order:
  google_event_id: string | null;
  auto_assigned: boolean;

// Add new interfaces:
export interface UserSettings {
  id: string;
  user_id: string;
  working_hours_start: string; // "HH:MM"
  working_hours_end: string;   // "HH:MM"
  daily_minutes_budget: number;
  doit_calendar_id: string | null;
  created_at: string;
  updated_at: string;
}

export type UserSettingsInsert = Omit<UserSettings, "id" | "user_id" | "created_at" | "updated_at">;
export type UserSettingsUpdate = Partial<UserSettingsInsert>;

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  allDay: boolean;
}

export interface DayCapacity {
  date: string;
  totalMinutes: number;
  eventMinutes: number;
  taskMinutes: number;
  freeMinutes: number;
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add UserSettings, CalendarEvent, DayCapacity types"
```

---

### Task 3: Google OAuth with Calendar Scope

**Files:**
- Modify: `src/app/login/page.tsx`

**Step 1: Add calendar scopes to OAuth request**

In the `signInWithGoogle` function, add scopes for Google Calendar:

```typescript
async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: "https://www.googleapis.com/auth/calendar",
    },
  });
}
```

That's the only change — Supabase will request the calendar scope during OAuth and store the provider token.

**Step 2: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add Google Calendar scope to OAuth sign-in"
```

---

### Task 4: Calendar API Helper & Routes

**Files:**
- Create: `src/lib/google-calendar.ts`
- Create: `src/app/api/calendar/events/route.ts`
- Create: `src/app/api/calendar/events/[eventId]/route.ts`
- Create: `src/app/api/calendar/setup/route.ts`
- Create: `src/lib/supabase/api.ts`

**Step 1: Create server-side Supabase client for API routes**

`src/lib/supabase/api.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createApiClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore in read-only context
          }
        },
      },
    }
  );
}
```

**Step 2: Create Google Calendar helper**

`src/lib/google-calendar.ts`:

```typescript
import { CalendarEvent } from "./types";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export async function getCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax + "T23:59:59").toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Calendar API error: ${res.status} ${error}`);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    id: item.id,
    summary: item.summary ?? "(No title)",
    start: item.start?.dateTime ?? item.start?.date ?? "",
    end: item.end?.dateTime ?? item.end?.date ?? "",
    allDay: !!item.start?.date && !item.start?.dateTime,
  }));
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    taskId: string;
  }
): Promise<string> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startDateTime },
        end: { dateTime: event.endDateTime },
        extendedProperties: {
          private: { doitTaskId: event.taskId },
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
  const data = await res.json();
  return data.id;
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete event: ${res.status}`);
  }
}

export async function createDoItCalendar(accessToken: string): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: "DoIt Tasks",
      description: "Task blocks created by DoIt",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });

  if (!res.ok) throw new Error(`Failed to create calendar: ${res.status}`);
  const data = await res.json();
  return data.id;
}

export async function listCalendars(
  accessToken: string
): Promise<{ id: string; summary: string }[]> {
  const res = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Failed to list calendars: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map((c: any) => ({ id: c.id, summary: c.summary }));
}
```

**Step 3: Create GET/POST /api/calendar/events**

`src/app/api/calendar/events/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getCalendarEvents, createCalendarEvent } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json({ error: "Not authenticated or no calendar access" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  try {
    const events = await getCalendarEvents(
      session.provider_token,
      "primary",
      start ?? date ?? new Date().toISOString().split("T")[0],
      end ?? date ?? new Date().toISOString().split("T")[0]
    );
    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createApiClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's DoIt calendar ID
  const { data: settings } = await supabase
    .from("user_settings")
    .select("doit_calendar_id")
    .single();

  if (!settings?.doit_calendar_id) {
    return NextResponse.json({ error: "DoIt calendar not set up" }, { status: 400 });
  }

  const body = await request.json();
  try {
    const eventId = await createCalendarEvent(
      session.provider_token,
      settings.doit_calendar_id,
      body
    );
    return NextResponse.json({ eventId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 4: Create DELETE /api/calendar/events/[eventId]**

`src/app/api/calendar/events/[eventId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { deleteCalendarEvent } from "@/lib/google-calendar";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = await createApiClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("doit_calendar_id")
    .single();

  if (!settings?.doit_calendar_id) {
    return NextResponse.json({ error: "DoIt calendar not set up" }, { status: 400 });
  }

  try {
    await deleteCalendarEvent(session.provider_token, settings.doit_calendar_id, eventId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 5: Create POST /api/calendar/setup**

`src/app/api/calendar/setup/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { createDoItCalendar } from "@/lib/google-calendar";

export async function POST() {
  const supabase = await createApiClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const calendarId = await createDoItCalendar(session.provider_token);

    // Upsert user settings with the new calendar ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No user" }, { status: 401 });

    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .single();

    if (existing) {
      await supabase
        .from("user_settings")
        .update({ doit_calendar_id: calendarId })
        .eq("user_id", user.id);
    } else {
      await supabase.from("user_settings").insert({
        user_id: user.id,
        doit_calendar_id: calendarId,
      });
    }

    return NextResponse.json({ calendarId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

**Step 6: Verify build**

```bash
cd ~/Downloads/Projects/DoIt && npm run build 2>&1 | tail -30
```

**Step 7: Commit**

```bash
git add src/lib/google-calendar.ts src/lib/supabase/api.ts src/app/api/
git commit -m "feat: add Google Calendar API routes and helper"
```

---

### Task 5: User Settings Hook

**Files:**
- Create: `src/hooks/use-settings.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserSettings, UserSettingsUpdate } from "@/lib/types";

const DEFAULT_SETTINGS: Omit<UserSettings, "id" | "user_id" | "created_at" | "updated_at"> = {
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  daily_minutes_budget: 120,
  doit_calendar_id: null,
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .single();

    if (data) {
      setSettings(data as UserSettings);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function updateSettings(updates: UserSettingsUpdate) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .single();

    if (existing) {
      const { error } = await supabase
        .from("user_settings")
        .update(updates)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("user_settings")
        .insert({ ...DEFAULT_SETTINGS, ...updates, user_id: user.id });
      if (error) throw error;
    }

    await fetchSettings();
  }

  async function setupCalendar() {
    const res = await fetch("/api/calendar/setup", { method: "POST" });
    if (!res.ok) throw new Error("Failed to set up calendar");
    const { calendarId } = await res.json();
    await fetchSettings();
    return calendarId;
  }

  const calendarConnected = !!settings?.doit_calendar_id;

  // Return defaults merged with actual settings
  const effectiveSettings = {
    working_hours_start: settings?.working_hours_start ?? DEFAULT_SETTINGS.working_hours_start,
    working_hours_end: settings?.working_hours_end ?? DEFAULT_SETTINGS.working_hours_end,
    daily_minutes_budget: settings?.daily_minutes_budget ?? DEFAULT_SETTINGS.daily_minutes_budget,
    doit_calendar_id: settings?.doit_calendar_id ?? null,
  };

  return {
    settings: effectiveSettings,
    loading,
    calendarConnected,
    updateSettings,
    setupCalendar,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-settings.ts
git commit -m "feat: add useSettings hook with calendar setup"
```

---

### Task 6: Score-Based Day Assignment Algorithm

**Files:**
- Create: `src/lib/scheduler.ts`

**Step 1: Implement the scoring algorithm**

```typescript
import { Task, CalendarEvent, DayCapacity } from "./types";
import { format, addDays, parseISO, differenceInCalendarDays, differenceInMinutes } from "date-fns";

interface SchedulerInput {
  task: { estimated_minutes: number; due_date: string | null; priority: "low" | "medium" | "high" };
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string; // "HH:MM"
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
  const tomorrow = addDays(today, 1);
  const tomorrowStr = format(tomorrow, "yyyy-MM-dd");

  // Determine candidate date range
  let endDate: Date;
  if (task.due_date) {
    endDate = addDays(parseISO(task.due_date), -1); // day before due date
    if (endDate < tomorrow) endDate = tomorrow; // at minimum, tomorrow
  } else {
    endDate = addDays(today, 14);
  }

  const totalDays = differenceInCalendarDays(endDate, tomorrow) + 1;
  const workMinutes = getWorkingMinutes(workingHoursStart, workingHoursEnd);

  // Pre-compute capacity for each candidate day
  const scores: DayScore[] = [];

  for (let i = 0; i < totalDays; i++) {
    const candidateDate = addDays(tomorrow, i);
    const dateStr = format(candidateDate, "yyyy-MM-dd");

    // --- Capacity ---
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

    // --- Proximity ---
    let proximityScore = 50; // default for no due date
    if (task.due_date) {
      const daysUntilDue = differenceInCalendarDays(parseISO(task.due_date), tomorrow);
      const daysUntilCandidate = i;
      if (daysUntilDue > 0) {
        proximityScore = 100 - ((daysUntilDue - daysUntilCandidate) / daysUntilDue) * 100;
      } else {
        proximityScore = 100; // overdue, maximize
      }
    }

    // --- Balance ---
    const longTasks = dayTasks.filter((t) => (t.estimated_minutes ?? 30) >= 45).length;
    const shortTasks = dayTasks.filter((t) => (t.estimated_minutes ?? 30) < 45).length;
    const isLongTask = task.estimated_minutes >= 45;

    let balanceScore = 70; // base
    if (isLongTask && longTasks >= 2) balanceScore -= 40; // too many long tasks
    if (!isLongTask && shortTasks >= 5) balanceScore -= 20; // too many short tasks
    if (dayTasks.length === 0) balanceScore = 90; // empty day is great
    if (longTasks <= 1 && isLongTask) balanceScore += 10; // room for a long task
    balanceScore = Math.max(0, Math.min(100, balanceScore));

    // --- Priority ---
    let priorityScore = 50;
    if (task.priority === "high") {
      priorityScore = 100 - (i / totalDays) * 80; // prefer earlier
    } else if (task.priority === "low") {
      priorityScore = 20 + (i / totalDays) * 60; // prefer later
    }

    const total =
      proximityScore * WEIGHTS.proximity +
      capacityScore * WEIGHTS.capacity +
      balanceScore * WEIGHTS.balance +
      priorityScore * WEIGHTS.priority;

    scores.push({
      date: dateStr,
      score: total,
      breakdown: {
        proximity: proximityScore,
        capacity: capacityScore,
        balance: balanceScore,
        priority: priorityScore,
      },
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

export function pickBestDay(input: SchedulerInput): string {
  const scores = scoreDays(input);

  // If no day has capacity, pick the one with most free time anyway
  if (scores.length === 0) {
    return format(addDays(new Date(), 1), "yyyy-MM-dd");
  }

  return scores[0].date;
}

export function getWorkingMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export function getDayCapacity(
  date: string,
  tasks: Task[],
  events: CalendarEvent[],
  workStart: string,
  workEnd: string
): DayCapacity {
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
```

**Step 2: Commit**

```bash
git add src/lib/scheduler.ts
git commit -m "feat: add score-based day assignment algorithm"
```

---

### Task 7: Expanded Task Creation Dialog

**Files:**
- Create: `src/components/tasks/create-task-dialog.tsx`
- Modify: `src/components/tasks/create-task-inline.tsx`
- Modify: `src/app/(app)/projects/[id]/page.tsx`
- Modify: `src/app/(app)/today/page.tsx`

**Step 1: Create the new dialog**

`src/components/tasks/create-task-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronDown } from "lucide-react";
import { TaskInsert, TaskPriority, Task, CalendarEvent } from "@/lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { pickBestDay } from "@/lib/scheduler";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateTaskDialogProps {
  projectId?: string;
  day?: string; // pre-filled when adding from daily list
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  onCreate: (task: TaskInsert) => Promise<void>;
}

const TIME_PRESETS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "2h", value: 120 },
];

export function CreateTaskDialog({
  projectId,
  day: prefillDay,
  existingTasks,
  calendarEvents,
  workingHoursStart,
  workingHoursEnd,
  dailyBudget,
  onCreate,
}: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [day, setDay] = useState(prefillDay ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [description, setDescription] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  function reset() {
    setName("");
    setDueDate("");
    setDay(prefillDay ?? "");
    setEstimatedMinutes(null);
    setCustomMinutes("");
    setPriority("medium");
    setDescription("");
    setShowDetails(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !dueDate || !estimatedMinutes) return;

    let assignedDay = day || null;
    let autoAssigned = false;

    // Auto-assign day if not provided
    if (!assignedDay) {
      assignedDay = pickBestDay({
        task: { estimated_minutes: estimatedMinutes, due_date: dueDate, priority },
        existingTasks,
        calendarEvents,
        workingHoursStart,
        workingHoursEnd,
        dailyBudget,
      });
      autoAssigned = true;
    }

    try {
      await onCreate({
        name: name.trim(),
        project_id: projectId ?? null,
        day: assignedDay,
        status: "planned",
        priority,
        description: description.trim() || null,
        estimated_minutes: estimatedMinutes,
        due_date: dueDate,
        split_allowed: false,
        tags: null,
        sort_order: 0,
        google_event_id: null,
        auto_assigned: autoAssigned,
      });
      reset();
      setOpen(false);
      toast.success(autoAssigned ? `Task auto-assigned to ${assignedDay}` : "Task created");
    } catch {
      toast.error("Failed to create task");
    }
  }

  const minutes = customMinutes ? parseInt(customMinutes) : estimatedMinutes;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start text-muted-foreground">
          <Plus className="h-4 w-4 mr-2" /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What needs to be done?"
              maxLength={80}
              autoFocus
              required
            />
          </div>

          <div>
            <Label>Due date *</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Estimated time *</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {TIME_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant={estimatedMinutes === preset.value && !customMinutes ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setEstimatedMinutes(preset.value); setCustomMinutes(""); }}
                >
                  {preset.label}
                </Button>
              ))}
              <Input
                type="number"
                placeholder="Custom"
                className="w-20"
                value={customMinutes}
                onChange={(e) => {
                  setCustomMinutes(e.target.value);
                  if (e.target.value) setEstimatedMinutes(parseInt(e.target.value));
                }}
                min={5}
                max={480}
              />
            </div>
          </div>

          <div>
            <Label>Priority</Label>
            <div className="flex gap-2 mt-1">
              {(["low", "medium", "high"] as TaskPriority[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={priority === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriority(p)}
                  className={cn(
                    priority === p && p === "high" && "bg-red-500 hover:bg-red-600",
                    priority === p && p === "low" && "bg-blue-500 hover:bg-blue-600"
                  )}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Schedule for day (leave blank for auto-assign)</Label>
            <Input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>

          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
                <ChevronDown className={cn("h-4 w-4 mr-1 transition-transform", showDetails && "rotate-180")} />
                Add details
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description, notes, steps..."
                rows={3}
              />
            </CollapsibleContent>
          </Collapsible>

          <Button type="submit" className="w-full" disabled={!name.trim() || !dueDate || !minutes}>
            {day ? "Create Task" : "Create & Auto-Assign"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Update create-task-inline.tsx**

Replace the old inline component to use the new dialog. Keep the file but change it to import and render CreateTaskDialog:

```tsx
"use client";

import { CreateTaskDialog } from "./create-task-dialog";
import { TaskInsert, Task, CalendarEvent } from "@/lib/types";

interface CreateTaskInlineProps {
  projectId?: string;
  day?: string;
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  onCreate: (task: TaskInsert) => Promise<void>;
}

export function CreateTaskInline(props: CreateTaskInlineProps) {
  return <CreateTaskDialog {...props} />;
}
```

**Step 3: Update project detail page and daily list page**

Both pages need to pass the new required props to CreateTaskInline. They need to:
1. Import and use `useSettings` hook
2. Fetch calendar events (or pass empty array if not connected)
3. Fetch all tasks (for the scheduler's capacity calculation)
4. Pass `existingTasks`, `calendarEvents`, `workingHoursStart`, `workingHoursEnd`, `dailyBudget` to CreateTaskInline

For the project detail page (`src/app/(app)/projects/[id]/page.tsx`):
- Add `useSettings` hook
- Add state for allTasks (fetched from Supabase — all tasks, not just project tasks)
- Add state for calendarEvents (fetched from /api/calendar/events for next 14 days)
- Pass to CreateTaskInline

For the daily list page (`src/app/(app)/today/page.tsx`):
- Add `useSettings` hook
- Pass existing tasks + calendar events + settings to CreateTaskInline

**Step 4: Add "auto" badge to TaskCard**

In `src/components/tasks/task-card.tsx`, add after the priority display:

```tsx
{task.auto_assigned && (
  <Badge variant="secondary" className="text-xs">auto</Badge>
)}
```

**Step 5: Verify build and commit**

```bash
git add src/components/tasks/ src/app/\(app\)/projects/ src/app/\(app\)/today/
git commit -m "feat: add expanded task creation dialog with auto-day-assignment"
```

---

### Task 8: Settings UI & Schedule Page

**Files:**
- Create: `src/components/schedule/settings-panel.tsx`
- Create: `src/components/schedule/day-timeline.tsx`
- Create: `src/components/schedule/schedule-button.tsx`
- Modify: `src/app/(app)/schedule/page.tsx`

**Step 1: Create settings panel**

`src/components/schedule/settings-panel.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Settings } from "lucide-react";
import { toast } from "sonner";

interface SettingsPanelProps {
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  calendarConnected: boolean;
  onUpdate: (updates: Record<string, any>) => Promise<void>;
  onSetupCalendar: () => Promise<string>;
}

export function SettingsPanel({
  workingHoursStart,
  workingHoursEnd,
  dailyBudget,
  calendarConnected,
  onUpdate,
  onSetupCalendar,
}: SettingsPanelProps) {
  async function handleCalendarSetup() {
    try {
      await onSetupCalendar();
      toast.success("DoIt Tasks calendar created in Google Calendar");
    } catch {
      toast.error("Failed to set up calendar. Make sure you signed in with Google Calendar access.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" /> Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Work starts</Label>
            <Input
              type="time"
              value={workingHoursStart}
              onChange={(e) => onUpdate({ working_hours_start: e.target.value })}
            />
          </div>
          <div>
            <Label>Work ends</Label>
            <Input
              type="time"
              value={workingHoursEnd}
              onChange={(e) => onUpdate({ working_hours_end: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label>Daily task budget (minutes)</Label>
          <Input
            type="number"
            value={dailyBudget}
            onChange={(e) => onUpdate({ daily_minutes_budget: parseInt(e.target.value) || 120 })}
            min={30}
            max={480}
          />
        </div>
        <div>
          <Label>Google Calendar</Label>
          {calendarConnected ? (
            <div className="flex items-center gap-2 mt-1 text-sm text-green-600">
              <CalendarCheck className="h-4 w-4" /> Connected — DoIt Tasks calendar active
            </div>
          ) : (
            <Button onClick={handleCalendarSetup} variant="outline" className="mt-1 w-full">
              Connect Google Calendar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create day timeline**

`src/components/schedule/day-timeline.tsx`:

A visual timeline showing calendar events and task blocks for the selected day. Shows time slots from working hours start to end, with events and tasks rendered as colored blocks.

```tsx
"use client";

import { CalendarEvent, Task } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { formatMinutes, cn } from "@/lib/utils";
import { parseISO, format } from "date-fns";

interface DayTimelineProps {
  date: string;
  events: CalendarEvent[];
  tasks: Task[];
  workStart: string;
  workEnd: string;
}

export function DayTimeline({ date, events, tasks, workStart, workEnd }: DayTimelineProps) {
  const [startH] = workStart.split(":").map(Number);
  const [endH] = workEnd.split(":").map(Number);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);

  const dayEvents = events.filter((e) => e.start.startsWith(date) && !e.allDay);
  const dayTasks = tasks.filter((t) => t.day === date && t.google_event_id && t.status !== "done");

  return (
    <div className="space-y-1">
      {hours.map((hour) => {
        const hourStr = `${hour.toString().padStart(2, "0")}:00`;
        const eventsInHour = dayEvents.filter((e) => {
          const h = parseInt(e.start.substring(11, 13));
          return h === hour;
        });
        const tasksInHour = dayTasks.filter((t) => {
          // Tasks with calendar events have event times — approximate by checking google_event_id
          return false; // Simplified: full implementation would parse event times
        });

        return (
          <div key={hour} className="flex gap-3 min-h-[3rem]">
            <span className="text-xs text-muted-foreground w-12 pt-1 text-right shrink-0">
              {format(new Date(2000, 0, 1, hour), "h a")}
            </span>
            <div className="flex-1 border-t pt-1 space-y-1">
              {eventsInHour.map((event) => (
                <div
                  key={event.id}
                  className="text-xs bg-blue-100 dark:bg-blue-900 rounded px-2 py-1"
                >
                  {event.summary}
                  <span className="text-muted-foreground ml-1">
                    {format(parseISO(event.start), "h:mm")} - {format(parseISO(event.end), "h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Create schedule button**

`src/components/schedule/schedule-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Task } from "@/lib/types";
import { toast } from "sonner";
import { addMinutes, format, parseISO } from "date-fns";

interface ScheduleButtonProps {
  date: string;
  tasks: Task[];
  freeSlots: { start: string; end: string }[];
  onEventCreated: (taskId: string, eventId: string) => void;
}

export function ScheduleButton({ date, tasks, freeSlots, onEventCreated }: ScheduleButtonProps) {
  const [scheduling, setScheduling] = useState(false);

  const unscheduledTasks = tasks.filter(
    (t) => t.day === date && !t.google_event_id && t.status === "planned" && t.estimated_minutes
  );

  if (unscheduledTasks.length === 0) return null;

  async function scheduleDay() {
    setScheduling(true);

    let slotIndex = 0;
    let slotOffset = 0; // minutes into current slot

    for (const task of unscheduledTasks) {
      if (slotIndex >= freeSlots.length) {
        toast.error(`Could not schedule ${task.name} — no free time`);
        continue;
      }

      const slot = freeSlots[slotIndex];
      const slotStart = parseISO(slot.start);
      const taskStart = addMinutes(slotStart, slotOffset);
      const taskEnd = addMinutes(taskStart, task.estimated_minutes!);

      try {
        const res = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: task.name,
            description: task.description ?? "",
            startDateTime: taskStart.toISOString(),
            endDateTime: taskEnd.toISOString(),
            taskId: task.id,
          }),
        });

        if (res.ok) {
          const { eventId } = await res.json();
          onEventCreated(task.id, eventId);
        }
      } catch {
        toast.error(`Failed to schedule ${task.name}`);
      }

      slotOffset += task.estimated_minutes!;
      const slotEnd = parseISO(slot.end);
      const remainingInSlot = (slotEnd.getTime() - slotStart.getTime()) / 60000 - slotOffset;
      if (remainingInSlot < 15) {
        slotIndex++;
        slotOffset = 0;
      }
    }

    setScheduling(false);
    toast.success("Day scheduled!");
  }

  return (
    <Button onClick={scheduleDay} disabled={scheduling} className="w-full">
      {scheduling ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scheduling...</>
      ) : (
        <><CalendarPlus className="h-4 w-4 mr-2" /> Schedule {unscheduledTasks.length} tasks</>
      )}
    </Button>
  );
}
```

**Step 4: Update schedule page**

Replace `src/app/(app)/schedule/page.tsx` with a full page using settings panel, timeline, and schedule button. Import useSettings, useTasks, fetch calendar events, render all three components.

**Step 5: Verify build and commit**

```bash
git add src/components/schedule/ src/app/\(app\)/schedule/
git commit -m "feat: add schedule page with settings, timeline, and day scheduling"
```

---

### Task 9: Wire Up Calendar Events in Pages

**Files:**
- Create: `src/hooks/use-calendar-events.ts`
- Modify: `src/app/(app)/projects/[id]/page.tsx`
- Modify: `src/app/(app)/today/page.tsx`

**Step 1: Create calendar events hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarEvent } from "@/lib/types";

export function useCalendarEvents(start: string, end: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar/events?start=${start}&end=${end}`);
      if (res.ok) {
        const { events: data } = await res.json();
        setEvents(data ?? []);
      }
    } catch {
      // Calendar not connected — that's fine, use empty events
    }
    setLoading(false);
  }, [start, end]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}
```

**Step 2: Update project detail and today pages**

Add useSettings, useCalendarEvents hooks. Pass data to CreateTaskInline. Fetch all tasks for scheduler context.

**Step 3: Commit**

```bash
git add src/hooks/use-calendar-events.ts src/app/\(app\)/
git commit -m "feat: wire calendar events into task creation and daily list"
```

---

### Task 10: Enable Google Calendar API in Google Cloud Console

**Manual step** — instruct user:

1. Go to Google Cloud Console → APIs & Services → Library
2. Search for "Google Calendar API"
3. Click Enable
4. This is required for the calendar API routes to work

---

### Task 11: Final Integration Testing & Push

**Step 1: Verify build**

```bash
cd ~/Downloads/Projects/DoIt && npm run build 2>&1 | tail -30
```

**Step 2: Push**

```bash
git push origin main
```

**Step 3: Test flow**

1. Sign out and sign back in (to get calendar scope)
2. Go to Schedule → Connect Google Calendar
3. Create a task on a project without a day → verify auto-assignment
4. Go to Schedule → Schedule day → verify events appear in Google Calendar
