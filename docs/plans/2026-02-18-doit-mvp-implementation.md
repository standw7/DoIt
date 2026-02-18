# DoIt MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the M1 MVP — projects, tasks, daily lists with suggestions, progress bars, and real-time cross-device sync.

**Architecture:** Next.js 15 App Router with Supabase (Postgres + Auth + Real-Time). Client talks to Supabase directly via RLS. No custom API routes. Google OAuth for auth. Optimistic updates for snappy UX.

**Tech Stack:** Next.js 15, TypeScript, Supabase, Tailwind CSS, shadcn/ui, date-fns, lucide-react

---

### Task 1: Project Scaffolding

**Files:**
- Create: `DoIt/` (Next.js project root)
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.env.local` (gitignored)

**Step 1: Create Next.js app**

```bash
cd ~/Downloads/Projects
rm -rf DoIt/.git  # preserve our files, reinit after scaffold
# Save existing files
cp DoIt/instructions.md /tmp/doit-instructions.md
cp -r DoIt/docs /tmp/doit-docs
npx create-next-app@latest DoIt --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Note: If DoIt directory exists, create-next-app may prompt. Handle accordingly — may need to scaffold into a temp dir and merge.

**Step 2: Restore project files and reinit git**

```bash
cd ~/Downloads/Projects/DoIt
cp /tmp/doit-instructions.md ./instructions.md
cp -r /tmp/doit-docs ./docs
git init
git remote add origin git@github.com:standw7/DoIt.git
```

**Step 3: Install dependencies**

```bash
cd ~/Downloads/Projects/DoIt
npm install @supabase/supabase-js @supabase/ssr date-fns
npm install -D @types/node
```

**Step 4: Initialize shadcn/ui**

```bash
cd ~/Downloads/Projects/DoIt
npx shadcn@latest init
# Choose: New York style, Zinc base color, CSS variables: yes
```

**Step 5: Add shadcn components we'll need**

```bash
npx shadcn@latest add button card dialog input label select textarea checkbox badge separator dropdown-menu popover calendar collapsible toast sonner
```

**Step 6: Create .env.local**

```
NEXT_PUBLIC_SUPABASE_URL=<from-supabase-dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase-dashboard>
```

**Step 7: Create .gitignore entry for .env.local**

Verify `.env.local` is already in `.gitignore` (create-next-app should handle this).

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 + Tailwind + shadcn/ui project"
git push -u origin main --force
```

---

### Task 2: Supabase Project & Database Setup

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Create Supabase project (manual)**

Go to https://supabase.com/dashboard and create a new project named "DoIt". Copy the project URL and anon key into `.env.local`.

**Step 2: Enable Google OAuth in Supabase (manual)**

In Supabase Dashboard → Authentication → Providers → Google:
- Enable Google provider
- Set up OAuth credentials in Google Cloud Console
- Add redirect URL from Supabase to Google OAuth config
- Copy client ID and secret into Supabase

**Step 3: Write the migration SQL**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 120),
  goal TEXT,
  definition_of_done TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) <= 80),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'planned', 'scheduled', 'done', 'skipped')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  day DATE,
  due_date DATE,
  estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR (estimated_minutes >= 5 AND estimated_minutes <= 480)),
  split_allowed BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tasks_user_day ON tasks(user_id, day);
CREATE INDEX idx_tasks_user_project ON tasks(user_id, project_id);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_projects_user ON projects(user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
```

**Step 4: Run migration in Supabase**

Run the SQL in Supabase Dashboard → SQL Editor, or use Supabase CLI if installed.

**Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema with RLS and realtime"
```

---

### Task 3: Supabase Client Configuration

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`

**Step 1: Create browser client**

`src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create server client**

`src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
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
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

**Step 3: Create middleware for session refresh**

`src/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 4: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: configure Supabase clients and auth middleware"
```

---

### Task 4: TypeScript Types

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Define database types**

`src/lib/types.ts`:

```typescript
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
  day: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  estimated_minutes: number | null;
  split_allowed: boolean;
  tags: string[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithProgress extends Project {
  progress: number; // 0-1
  task_count: number;
  done_count: number;
}

export type TaskInsert = Omit<Task, "id" | "user_id" | "created_at" | "updated_at">;
export type TaskUpdate = Partial<TaskInsert>;
export type ProjectInsert = Omit<Project, "id" | "user_id" | "created_at" | "updated_at">;
export type ProjectUpdate = Partial<ProjectInsert>;
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript types for database entities"
```

---

### Task 5: Utility Functions

**Files:**
- Create: `src/lib/utils.ts` (extend the shadcn one)

**Step 1: Add utility functions**

The shadcn init already created `src/lib/utils.ts` with `cn()`. Extend it:

```typescript
// Keep existing cn() from shadcn

import { Task } from "./types";
import { format, parseISO, addDays, isBefore, isEqual, isAfter } from "date-fns";

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
      if (isBefore(due, targetDate)) score += 100; // overdue
      else if (isEqual(due, targetDate)) score += 80; // due today
      else if (isBefore(due, addDays(targetDate, 4))) score += 60; // due soon (3 days)
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
```

**Step 2: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat: add progress calculation and suggestion utilities"
```

---

### Task 6: Auth — Login Page & Callback

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/callback/route.ts`

**Step 1: Create login page**

`src/app/login/page.tsx`:

```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckSquare } from "lucide-react";

export default function LoginPage() {
  const supabase = createClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="flex items-center gap-2 text-3xl font-bold">
          <CheckSquare className="h-8 w-8" />
          DoIt
        </div>
        <p className="text-muted-foreground text-center max-w-sm">
          A calm daily list and project backlog to help you focus on what matters.
        </p>
        <Button onClick={signInWithGoogle} size="lg">
          Sign in with Google
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Create auth callback route**

`src/app/auth/callback/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

**Step 3: Commit**

```bash
git add src/app/login/ src/app/auth/
git commit -m "feat: add Google OAuth login and callback"
```

---

### Task 7: Root Layout & Navigation

**Files:**
- Create: `src/components/nav/bottom-nav.tsx`
- Create: `src/components/nav/sidebar-nav.tsx`
- Create: `src/components/nav/nav-wrapper.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create bottom nav (mobile)**

`src/components/nav/bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FolderKanban, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/schedule", label: "Schedule", icon: Clock },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="flex h-16 items-center justify-around">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 text-xs",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 2: Create sidebar nav (desktop)**

`src/components/nav/sidebar-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FolderKanban, Clock, CheckSquare, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/schedule", label: "Schedule", icon: Clock },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-background md:fixed md:inset-y-0">
      <div className="flex h-14 items-center gap-2 px-4 font-bold text-lg border-b">
        <CheckSquare className="h-5 w-5" />
        DoIt
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
```

**Step 3: Create nav wrapper**

`src/components/nav/nav-wrapper.tsx`:

```tsx
import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";

export function NavWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SidebarNav />
      <main className="pb-20 md:pb-0 md:pl-56">{children}</main>
      <BottomNav />
    </div>
  );
}
```

**Step 4: Update root layout**

Modify `src/app/layout.tsx` to include the nav wrapper for authenticated routes. The layout should conditionally show nav (not on /login).

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DoIt",
  description: "A calm daily list and project backlog",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

Create `src/app/(app)/layout.tsx` for authenticated routes with nav:

```tsx
import { NavWrapper } from "@/components/nav/nav-wrapper";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <NavWrapper>{children}</NavWrapper>;
}
```

Move route files into `(app)` route group:
- `src/app/(app)/today/page.tsx`
- `src/app/(app)/projects/page.tsx`
- `src/app/(app)/projects/[id]/page.tsx`
- `src/app/(app)/schedule/page.tsx`

**Step 5: Update root page to redirect**

`src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/today");
}
```

**Step 6: Commit**

```bash
git add src/components/nav/ src/app/
git commit -m "feat: add responsive navigation with bottom bar and sidebar"
```

---

### Task 8: Projects List Page

**Files:**
- Create: `src/app/(app)/projects/page.tsx`
- Create: `src/components/projects/project-card.tsx`
- Create: `src/components/projects/progress-bar.tsx`
- Create: `src/components/projects/create-project-dialog.tsx`
- Create: `src/hooks/use-projects.ts`

**Step 1: Create use-projects hook**

`src/hooks/use-projects.ts`:

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Project, ProjectWithProgress, ProjectInsert, Task } from "@/lib/types";
import { calculateProgress } from "@/lib/utils";

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    const { data: projectData } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (!projectData) return;

    // Fetch tasks for progress calculation
    const { data: taskData } = await supabase
      .from("tasks")
      .select("id, project_id, status, estimated_minutes")
      .not("project_id", "is", null);

    const tasks = (taskData ?? []) as Pick<Task, "id" | "project_id" | "status" | "estimated_minutes">[];

    const withProgress: ProjectWithProgress[] = projectData.map((p: Project) => {
      const projectTasks = tasks.filter((t) => t.project_id === p.id) as Task[];
      return {
        ...p,
        progress: calculateProgress(projectTasks),
        task_count: projectTasks.length,
        done_count: projectTasks.filter((t) => t.status === "done").length,
      };
    });

    setProjects(withProgress);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel("projects-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => fetchProjects())
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchProjects())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchProjects, supabase]);

  async function createProject(project: ProjectInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("projects").insert({
      ...project,
      user_id: user.id,
    });
    if (error) throw error;
  }

  async function updateProject(id: string, updates: Partial<ProjectInsert>) {
    const { error } = await supabase.from("projects").update(updates).eq("id", id);
    if (error) throw error;
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
  }

  return { projects, loading, createProject, updateProject, deleteProject };
}
```

**Step 2: Create progress bar component**

`src/components/projects/progress-bar.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number; // 0-1
  className?: string;
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  const percent = Math.round(progress * 100);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{percent}%</span>
    </div>
  );
}
```

**Step 3: Create project card**

`src/components/projects/project-card.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "./progress-bar";
import { ProjectWithProgress } from "@/lib/types";

interface ProjectCardProps {
  project: ProjectWithProgress;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{project.name}</CardTitle>
          {project.goal && (
            <p className="text-sm text-muted-foreground line-clamp-2">{project.goal}</p>
          )}
        </CardHeader>
        <CardContent>
          <ProgressBar progress={project.progress} />
          <p className="text-xs text-muted-foreground mt-1">
            {project.done_count}/{project.task_count} tasks
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 4: Create project dialog**

`src/components/projects/create-project-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CreateProjectDialogProps {
  onCreate: (project: { name: string; goal: string | null; definition_of_done: string | null }) => Promise<void>;
}

export function CreateProjectDialog({ onCreate }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await onCreate({
        name: name.trim(),
        goal: goal.trim() || null,
        definition_of_done: null,
      });
      setName("");
      setGoal("");
      setOpen(false);
      toast.success("Project created");
    } catch {
      toast.error("Failed to create project");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" maxLength={120} required />
          </div>
          <div>
            <Label htmlFor="goal">Goal (optional)</Label>
            <Textarea id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What does success look like?" rows={3} />
          </div>
          <Button type="submit" className="w-full">Create</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 5: Create projects list page**

`src/app/(app)/projects/page.tsx`:

```tsx
"use client";

import { useProjects } from "@/hooks/use-projects";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  const { projects, loading, createProject } = useProjects();

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading projects...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <CreateProjectDialog onCreate={createProject} />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FolderKanban className="h-12 w-12 mb-4" />
          <p>No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add src/hooks/use-projects.ts src/components/projects/ src/app/\(app\)/projects/page.tsx
git commit -m "feat: add projects list page with progress bars and create dialog"
```

---

### Task 9: Project Detail Page + Task CRUD

**Files:**
- Create: `src/app/(app)/projects/[id]/page.tsx`
- Create: `src/hooks/use-tasks.ts`
- Create: `src/components/tasks/task-card.tsx`
- Create: `src/components/tasks/create-task-inline.tsx`
- Create: `src/components/tasks/task-detail-dialog.tsx`

**Step 1: Create use-tasks hook**

`src/hooks/use-tasks.ts`:

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Task, TaskInsert, TaskUpdate } from "@/lib/types";

interface UseTasksOptions {
  projectId?: string;
  day?: string;
  statuses?: string[];
}

export function useTasks(options: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTasks = useCallback(async () => {
    let query = supabase.from("tasks").select("*");

    if (options.projectId) {
      query = query.eq("project_id", options.projectId);
    }
    if (options.day) {
      query = query.eq("day", options.day);
    }
    if (options.statuses) {
      query = query.in("status", options.statuses);
    }

    query = query.order("sort_order").order("created_at");

    const { data } = await query;
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  }, [supabase, options.projectId, options.day, options.statuses]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel(`tasks-${options.projectId ?? options.day ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => fetchTasks())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTasks, supabase, options.projectId, options.day]);

  async function createTask(task: TaskInsert) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("tasks").insert({
      ...task,
      user_id: user.id,
    });
    if (error) throw error;
  }

  async function updateTask(id: string, updates: TaskUpdate) {
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) throw error;
  }

  async function deleteTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
  }

  async function toggleDone(task: Task) {
    const newStatus = task.status === "done" ? (task.day ? "planned" : "backlog") : "done";
    await updateTask(task.id, { status: newStatus });
  }

  async function assignToDay(taskId: string, day: string) {
    await updateTask(taskId, { day, status: "planned" });
  }

  return { tasks, loading, createTask, updateTask, deleteTask, toggleDone, assignToDay };
}
```

**Step 2: Create task card component**

`src/components/tasks/task-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, CalendarPlus } from "lucide-react";
import { Task } from "@/lib/types";
import { cn, formatMinutes } from "@/lib/utils";
import { TaskDetailDialog } from "./task-detail-dialog";

interface TaskCardProps {
  task: Task;
  onToggleDone: (task: Task) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAssignToDay?: (taskId: string) => void;
  showProject?: boolean;
}

const priorityColors = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
};

export function TaskCard({ task, onToggleDone, onUpdate, onDelete, onAssignToDay, showProject }: TaskCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const isDone = task.status === "done";

  return (
    <>
      <Card className={cn("flex items-start gap-3 p-3", isDone && "opacity-60")}>
        <Checkbox
          checked={isDone}
          onCheckedChange={() => onToggleDone(task)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailOpen(true)}>
          <p className={cn("text-sm font-medium", isDone && "line-through")}>{task.name}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.estimated_minutes && (
              <span className="text-xs text-muted-foreground">{formatMinutes(task.estimated_minutes)}</span>
            )}
            {task.priority !== "medium" && (
              <span className={cn("text-xs font-medium", priorityColors[task.priority])}>
                {task.priority}
              </span>
            )}
            {task.due_date && (
              <Badge variant="outline" className="text-xs">{task.due_date}</Badge>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onAssignToDay && (
              <DropdownMenuItem onClick={() => onAssignToDay(task.id)}>
                <CalendarPlus className="h-4 w-4 mr-2" /> Add to today
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
      <TaskDetailDialog
        task={task}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}
```

**Step 3: Create task detail dialog**

`src/components/tasks/task-detail-dialog.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Task, TaskPriority } from "@/lib/types";
import { toast } from "sonner";

interface TaskDetailDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskDetailDialog({ task, open, onOpenChange, onUpdate, onDelete }: TaskDetailDialogProps) {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimated_minutes?.toString() ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [day, setDay] = useState(task.day ?? "");

  useEffect(() => {
    setName(task.name);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setEstimatedMinutes(task.estimated_minutes?.toString() ?? "");
    setDueDate(task.due_date ?? "");
    setDay(task.day ?? "");
  }, [task]);

  function handleSave() {
    try {
      onUpdate(task.id, {
        name: name.trim(),
        description: description.trim() || null,
        priority,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
        due_date: dueDate || null,
        day: day || null,
        status: day && task.status === "backlog" ? "planned" : task.status,
      });
      onOpenChange(false);
      toast.success("Task updated");
    } catch {
      toast.error("Failed to update task");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated minutes</Label>
              <Input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} min={5} max={480} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Day (daily list)</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">Save</Button>
            <Button variant="destructive" onClick={() => { onDelete(task.id); onOpenChange(false); }}>Delete</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Create inline task creation**

`src/components/tasks/create-task-inline.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TaskInsert } from "@/lib/types";
import { toast } from "sonner";

interface CreateTaskInlineProps {
  projectId?: string;
  day?: string;
  onCreate: (task: TaskInsert) => Promise<void>;
}

export function CreateTaskInline({ projectId, day, onCreate }: CreateTaskInlineProps) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await onCreate({
        name: name.trim(),
        project_id: projectId ?? null,
        day: day ?? null,
        status: day ? "planned" : "backlog",
        priority: "medium",
        description: null,
        estimated_minutes: null,
        due_date: null,
        split_allowed: false,
        tags: null,
        sort_order: 0,
      });
      setName("");
      setAdding(false);
    } catch {
      toast.error("Failed to create task");
    }
  }

  if (!adding) {
    return (
      <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => setAdding(true)}>
        <Plus className="h-4 w-4 mr-2" /> Add task
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Task name..."
        maxLength={80}
        autoFocus
        onBlur={() => { if (!name.trim()) setAdding(false); }}
      />
      <Button type="submit" size="sm">Add</Button>
    </form>
  );
}
```

**Step 5: Create project detail page**

`src/app/(app)/projects/[id]/page.tsx`:

```tsx
"use client";

import { use } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { TaskCard } from "@/components/tasks/task-card";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";
import { ProgressBar } from "@/components/projects/progress-bar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { tasks, loading, createTask, updateTask, deleteTask, toggleDone } = useTasks({ projectId: id });
  const { projects } = useProjects();

  const project = projects.find((p) => p.id === id);

  const backlogTasks = tasks.filter((t) => t.status === "backlog");
  const plannedTasks = tasks.filter((t) => t.status === "planned" || t.status === "scheduled");
  const doneTasks = tasks.filter((t) => t.status === "done");

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/projects">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Projects
        </Button>
      </Link>

      <h1 className="text-2xl font-bold">{project?.name ?? "Project"}</h1>
      {project?.goal && <p className="text-muted-foreground mt-1">{project.goal}</p>}
      {project && <ProgressBar progress={project.progress} className="mt-4 mb-6" />}

      <CreateTaskInline projectId={id} onCreate={createTask} />

      {backlogTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Backlog ({backlogTasks.length})</h2>
          <div className="space-y-2">
            {backlogTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
            ))}
          </div>
        </section>
      )}

      {plannedTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Planned ({plannedTasks.length})</h2>
          <div className="space-y-2">
            {plannedTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
            ))}
          </div>
        </section>
      )}

      {doneTasks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-2">Done ({doneTasks.length})</h2>
          <div className="space-y-2">
            {doneTasks.map((task) => (
              <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add src/hooks/use-tasks.ts src/components/tasks/ src/app/\(app\)/projects/
git commit -m "feat: add project detail page with task CRUD"
```

---

### Task 10: Daily List Page

**Files:**
- Create: `src/app/(app)/today/page.tsx`
- Create: `src/components/daily/date-selector.tsx`
- Create: `src/components/daily/suggested-tasks.tsx`

**Step 1: Create date selector**

`src/components/daily/date-selector.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, addDays, subDays, isToday } from "date-fns";

interface DateSelectorProps {
  date: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

export function DateSelector({ date, onChange }: DateSelectorProps) {
  const parsed = parseISO(date);
  const today = isToday(parsed);

  function goBack() {
    onChange(format(subDays(parsed, 1), "yyyy-MM-dd"));
  }

  function goForward() {
    onChange(format(addDays(parsed, 1), "yyyy-MM-dd"));
  }

  function goToday() {
    onChange(format(new Date(), "yyyy-MM-dd"));
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={goBack}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[200px]">
            <CalendarDays className="h-4 w-4 mr-2" />
            {format(parsed, "EEEE, MMM d")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={(d) => d && onChange(format(d, "yyyy-MM-dd"))}
          />
        </PopoverContent>
      </Popover>

      <Button variant="ghost" size="icon" onClick={goForward}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!today && (
        <Button variant="ghost" size="sm" onClick={goToday}>
          Today
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Create suggested tasks section**

`src/components/daily/suggested-tasks.tsx`:

```tsx
"use client";

import { Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle } from "lucide-react";
import { cn, formatMinutes } from "@/lib/utils";
import { isBefore, parseISO } from "date-fns";

interface SuggestedTasksProps {
  tasks: Task[];
  date: string;
  onAdd: (taskId: string, day: string) => void;
}

export function SuggestedTasks({ tasks, date, onAdd }: SuggestedTasksProps) {
  if (tasks.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Suggested</h2>
      <div className="space-y-2 opacity-75">
        {tasks.map((task) => {
          const overdue = task.due_date && isBefore(parseISO(task.due_date), parseISO(date));
          return (
            <Card key={task.id} className={cn("flex items-center gap-3 p-3", overdue && "border-red-300")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                  <p className="text-sm">{task.name}</p>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {task.estimated_minutes && (
                    <span className="text-xs text-muted-foreground">{formatMinutes(task.estimated_minutes)}</span>
                  )}
                  {task.due_date && (
                    <Badge variant={overdue ? "destructive" : "outline"} className="text-xs">
                      Due {task.due_date}
                    </Badge>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onAdd(task.id, date)}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
```

**Step 3: Create daily list page**

`src/app/(app)/today/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTasks } from "@/hooks/use-tasks";
import { Task } from "@/lib/types";
import { DateSelector } from "@/components/daily/date-selector";
import { SuggestedTasks } from "@/components/daily/suggested-tasks";
import { TaskCard } from "@/components/tasks/task-card";
import { CreateTaskInline } from "@/components/tasks/create-task-inline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ListChecks } from "lucide-react";
import { todayString, getSuggestedTasks } from "@/lib/utils";

export default function TodayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const date = searchParams.get("date") ?? todayString();
  const [allBacklogTasks, setAllBacklogTasks] = useState<Task[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);
  const supabase = createClient();

  const { tasks, loading, createTask, updateTask, deleteTask, toggleDone, assignToDay } = useTasks({ day: date });

  // Fetch all backlog tasks for suggestions
  const fetchBacklog = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "backlog")
      .is("day", null);
    setAllBacklogTasks((data ?? []) as Task[]);
  }, [supabase]);

  useEffect(() => {
    fetchBacklog();
  }, [fetchBacklog]);

  function changeDate(newDate: string) {
    router.push(`/today?date=${newDate}`);
  }

  const plannedTasks = tasks.filter((t) => t.status === "planned" || t.status === "scheduled");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const suggested = getSuggestedTasks(allBacklogTasks, date);

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <DateSelector date={date} onChange={changeDate} />

      <div className="mt-6">
        <CreateTaskInline day={date} onCreate={createTask} />
      </div>

      {plannedTasks.length === 0 && doneTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ListChecks className="h-12 w-12 mb-4" />
          <p>No tasks for this day yet.</p>
          <p className="text-sm">Add a task above or pick from suggestions below.</p>
        </div>
      ) : (
        <>
          {plannedTasks.length > 0 && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                Planned ({plannedTasks.length})
              </h2>
              <div className="space-y-2">
                {plannedTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
                ))}
              </div>
            </section>
          )}

          {doneTasks.length > 0 && (
            <Collapsible open={doneOpen} onOpenChange={setDoneOpen} className="mt-6">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-muted-foreground">
                  Done ({doneTasks.length})
                  <ChevronDown className={`h-4 w-4 transition-transform ${doneOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {doneTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onToggleDone={toggleDone} onUpdate={updateTask} onDelete={deleteTask} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      <SuggestedTasks tasks={suggested} date={date} onAdd={assignToDay} />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/\(app\)/today/ src/components/daily/
git commit -m "feat: add daily list page with date selector and suggested tasks"
```

---

### Task 11: Schedule Placeholder Page

**Files:**
- Create: `src/app/(app)/schedule/page.tsx`

**Step 1: Create placeholder**

`src/app/(app)/schedule/page.tsx`:

```tsx
import { Clock } from "lucide-react";

export default function SchedulePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground p-6">
      <Clock className="h-12 w-12 mb-4" />
      <h1 className="text-xl font-semibold mb-2">Schedule</h1>
      <p className="text-center max-w-sm">
        Calendar scheduling is coming soon. You&apos;ll be able to schedule your daily tasks into Google Calendar free time.
      </p>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/schedule/
git commit -m "feat: add schedule placeholder page"
```

---

### Task 12: PWA Manifest & Mobile Polish

**Files:**
- Create: `public/manifest.json`
- Modify: `src/app/layout.tsx` (add manifest link + viewport meta)

**Step 1: Create PWA manifest**

`public/manifest.json`:

```json
{
  "name": "DoIt",
  "short_name": "DoIt",
  "description": "A calm daily list and project backlog",
  "start_url": "/today",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#09090b",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Step 2: Add manifest link to layout**

In `src/app/layout.tsx`, add to the `<head>` via metadata:

```typescript
export const metadata: Metadata = {
  title: "DoIt",
  description: "A calm daily list and project backlog",
  manifest: "/manifest.json",
  themeColor: "#09090b",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};
```

Note: Generate placeholder icon PNGs (192x192 and 512x512) — can be simple colored squares with "D" for now.

**Step 3: Commit**

```bash
git add public/manifest.json src/app/layout.tsx
git commit -m "feat: add PWA manifest for mobile home screen"
```

---

### Task 13: CLAUDE.md for the Project

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write project CLAUDE.md**

```markdown
# DoIt

A calm, single-user daily list + project backlog system with Google Calendar scheduling (future) and LLM-assisted planning (future).

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Real-Time)
- **Auth**: Google OAuth via Supabase
- **Hosting**: Vercel + Supabase

## Setup

1. Clone: `git clone https://github.com/standw7/DoIt.git`
2. Install: `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in Supabase credentials
4. Run: `npm run dev`
5. Open http://localhost:3000

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key

## Architecture

- Client talks to Supabase directly (no custom API routes for CRUD)
- Row-Level Security (RLS) enforces single-user data isolation
- Real-time subscriptions for cross-device sync
- No separate daily_lists table — daily list = tasks where `day = <date>`

## Key Files

- `src/app/(app)/today/page.tsx` — Daily list view
- `src/app/(app)/projects/page.tsx` — Projects list
- `src/app/(app)/projects/[id]/page.tsx` — Project detail with tasks
- `src/hooks/use-tasks.ts` — Task CRUD + real-time
- `src/hooks/use-projects.ts` — Project CRUD + real-time
- `src/lib/types.ts` — TypeScript types
- `src/lib/utils.ts` — Progress calculation, suggestion logic, date helpers
- `supabase/migrations/` — Database schema

## Milestones

1. **MVP core** (current) — Projects, tasks, daily lists, progress bars, suggestions
2. Calendar read-only — OAuth + free/busy view
3. Scheduling preview — Generate plan without writing events
4. Calendar write — Commit events + idempotency + undo
5. LLM import/export — Export prompt payload, import JSON + validation
```

**Step 2: Create .env.local.example**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

**Step 3: Commit**

```bash
git add CLAUDE.md .env.local.example
git commit -m "docs: add CLAUDE.md and env example"
```

---

### Task 14: Final Push

**Step 1: Push all commits**

```bash
git push origin main
```

**Step 2: Verify deployment**

If Vercel is connected, verify the deployment succeeded. Otherwise, set up Vercel project linking.
