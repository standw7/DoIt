# DoIt MVP (Milestone 1) Design

## Overview

A calm, single-user "daily list + project backlog" system. M1 covers: projects, tasks, daily lists, progress bars, and suggested tasks. No calendar integration or LLM import yet.

## Decisions

- **Stack**: Next.js 15 (App Router) + Supabase (Postgres, Auth, Real-Time) + Tailwind + shadcn/ui
- **Architecture**: Client talks to Supabase directly with RLS. No custom API routes for CRUD.
- **Auth**: Google OAuth via Supabase Auth
- **Hosting**: Vercel (frontend) + Supabase (database)
- **State**: React built-in state + Supabase real-time subscriptions. No Redux/Zustand.

## Data Model

### projects

| Column              | Type         | Notes                         |
|---------------------|--------------|-------------------------------|
| id                  | UUID (PK)    | gen_random_uuid()             |
| user_id             | UUID (FK)    | → auth.users, NOT NULL        |
| name                | TEXT         | NOT NULL, max 120 chars       |
| goal                | TEXT         |                               |
| definition_of_done  | TEXT         |                               |
| created_at          | TIMESTAMPTZ  | default now()                 |
| updated_at          | TIMESTAMPTZ  | default now()                 |

### tasks

| Column            | Type         | Notes                                        |
|-------------------|--------------|----------------------------------------------|
| id                | UUID (PK)    | gen_random_uuid()                            |
| user_id           | UUID (FK)    | → auth.users, NOT NULL                       |
| project_id        | UUID (FK)    | → projects, NULLABLE                         |
| name              | TEXT         | NOT NULL, max 80 chars                       |
| description       | TEXT         |                                              |
| status            | TEXT         | 'backlog' / 'planned' / 'scheduled' / 'done' / 'skipped' |
| priority          | TEXT         | 'low' / 'medium' / 'high', default 'medium' |
| day               | DATE         | NULLABLE — daily list membership             |
| due_date          | DATE         | NULLABLE — deadline driver                   |
| estimated_minutes | INTEGER      | NULLABLE, 5–480                              |
| split_allowed     | BOOLEAN      | default false                                |
| tags              | TEXT[]       | NULLABLE                                     |
| sort_order        | INTEGER      | ordering within daily list                   |
| created_at        | TIMESTAMPTZ  |                                              |
| updated_at        | TIMESTAMPTZ  |                                              |

No separate `daily_lists` table — a daily list is the set of tasks where `day = <date>`.

### RLS Policies

All tables: `WHERE user_id = auth.uid()` on SELECT, INSERT, UPDATE, DELETE.

### Progress Bar

```sql
SELECT
  COALESCE(
    SUM(CASE WHEN status = 'done' THEN estimated_minutes ELSE 0 END)::float
    / NULLIF(SUM(estimated_minutes), 0),
    SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END)::float
    / NULLIF(COUNT(*), 0)
  )
FROM tasks WHERE project_id = ?
```

Weighted by estimated minutes; falls back to count-based if no estimates.

## App Structure & Navigation

### Routes

| Route                      | Purpose                          |
|----------------------------|----------------------------------|
| /                          | Redirect to /today               |
| /today                     | Daily list (today by default)    |
| /today?date=YYYY-MM-DD    | Daily list for specific date     |
| /projects                  | Projects list with progress bars |
| /projects/[id]             | Project detail with tasks        |
| /login                     | Google OAuth sign-in             |
| /schedule                  | Placeholder (M2+)               |

### Layout

- Bottom nav on mobile (3 tabs: Today, Projects, Schedule)
- Sidebar nav on desktop
- Schedule tab shows "Coming soon" in M1

### Daily List Sections

1. Date header with prev/next arrows + date picker
2. Planned tasks — cards with checkbox, name, project tag, estimated time
3. Suggested tasks — dimmed section, one-tap to add
4. Done tasks — collapsed by default

### Task Interactions

- Tap checkbox → toggle done/undone
- Tap card → expand detail (edit all fields)
- "..." menu → delete, add to day, change project

## Suggested Tasks Logic

Tasks shown as suggestions for a given date (capped at ~5-7):

1. **Overdue**: `due_date < selected_date` — always shown, warning highlight
2. **Due today**: `due_date = selected_date`
3. **Due soon**: `due_date` within next 3 days
4. **High priority backlog**: `priority = 'high'`, no day assigned

Only tasks with `status = 'backlog'` (not assigned to any day). Tapping "Add" sets `day = date` and `status = 'planned'`.

## Real-Time Sync

- Supabase real-time subscriptions on `tasks` and `projects` tables
- Optimistic updates with rollback on failure
- No offline support in M1 (error toast if offline)
- PWA manifest for "add to home screen" but no service worker caching

## Project Structure

```
DoIt/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/page.tsx
│   │   ├── today/page.tsx
│   │   ├── projects/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── schedule/page.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn
│   │   ├── nav/
│   │   ├── tasks/
│   │   ├── projects/
│   │   └── daily/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   └── hooks/
│       ├── use-tasks.ts
│       └── use-projects.ts
├── supabase/
│   └── migrations/
├── public/
│   └── manifest.json
├── docs/
│   └── plans/
├── CLAUDE.md
├── instructions.md
└── package.json
```

## Dependencies

- next 15 (App Router)
- @supabase/supabase-js + @supabase/ssr
- tailwindcss + shadcn/ui
- date-fns
- lucide-react
