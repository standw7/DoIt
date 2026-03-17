# DoIt Codebase Guide

A navigation aid for understanding this codebase without reading every file. For setup/run instructions, see `CLAUDE.md`.

## Project Structure

```
DoIt/
├── src/
│   ├── app/                        # Next.js App Router pages & API routes
│   │   ├── (app)/                  # Route group — authenticated pages with nav layout
│   │   │   ├── today/page.tsx      # Daily task list view (default landing page)
│   │   │   ├── tasks/page.tsx      # All tasks + recurring tasks management
│   │   │   ├── projects/           # Project list & detail pages
│   │   │   │   ├── page.tsx        # Project list with progress bars
│   │   │   │   └── [id]/page.tsx   # Single project: tasks grouped by status
│   │   │   ├── schedule/page.tsx   # Day timeline, auto-assign, calendar scheduling
│   │   │   ├── settings/page.tsx   # User preferences (hours, budget, calendar, digest)
│   │   │   ├── help/page.tsx       # Help accordion (static content)
│   │   │   └── layout.tsx          # Wraps children in NavWrapper (sidebar + bottom nav)
│   │   ├── api/
│   │   │   ├── calendar/
│   │   │   │   ├── events/route.ts         # GET: fetch events, POST: create event
│   │   │   │   ├── events/[eventId]/route.ts # PATCH: reschedule, DELETE: remove event
│   │   │   │   └── setup/route.ts          # POST: create "DoIt Tasks" Google Calendar
│   │   │   └── digest/send/route.ts        # GET: Vercel cron — sends daily digest emails
│   │   ├── auth/callback/route.ts  # OAuth callback — exchanges code, stores refresh token
│   │   ├── login/page.tsx          # Google OAuth sign-in page
│   │   ├── page.tsx                # Root redirect to /today
│   │   ├── layout.tsx              # Root layout: fonts, metadata, Toaster
│   │   └── globals.css             # Tailwind v4 base styles
│   ├── components/
│   │   ├── daily/                  # Today-page-specific components
│   │   │   ├── date-selector.tsx   # Date picker with prev/next/today buttons
│   │   │   └── suggested-tasks.tsx # Backlog tasks suggested by due date/priority
│   │   ├── tasks/                  # Task CRUD components (used across pages)
│   │   │   ├── task-card.tsx       # Card with checkbox, edit, delete, unschedule
│   │   │   ├── task-detail-dialog.tsx # Full edit dialog for a task
│   │   │   ├── create-task-dialog.tsx # New task dialog (one-time or recurring)
│   │   │   └── create-task-inline.tsx # Thin wrapper around CreateTaskDialog
│   │   ├── projects/
│   │   │   ├── project-card.tsx    # Project card with progress bar (link to detail)
│   │   │   ├── create-project-dialog.tsx # New project dialog
│   │   │   └── progress-bar.tsx    # Horizontal progress bar (0-100%)
│   │   ├── schedule/
│   │   │   ├── day-timeline.tsx    # Visual timeline: events (blue) + auto-stacked tasks (green)
│   │   │   ├── schedule-button.tsx # "Schedule my day" — creates Google Calendar events
│   │   │   ├── conflict-reschedule.tsx # Detects task/event overlaps, offers one-click fix
│   │   │   ├── overdue-review.tsx  # Card for overdue tasks: reschedule/done/skip
│   │   │   └── settings-panel.tsx  # Settings form (hours, budget, calendar, digest)
│   │   ├── settings/
│   │   │   ├── recurring-tasks-section.tsx # List of recurring task templates
│   │   │   └── recurring-task-dialog.tsx   # Create/edit recurring task dialog
│   │   ├── nav/
│   │   │   ├── nav-wrapper.tsx     # Layout shell: sidebar (desktop) + bottom nav (mobile)
│   │   │   ├── sidebar-nav.tsx     # Desktop left sidebar with links + sign out
│   │   │   └── bottom-nav.tsx      # Mobile bottom tab bar
│   │   └── ui/                     # shadcn/ui primitives (don't edit these directly)
│   ├── hooks/                      # Client-side data hooks (all "use client")
│   │   ├── use-tasks.ts           # Task CRUD + real-time subscriptions + optimistic updates
│   │   ├── use-projects.ts        # Project CRUD + real-time + progress calculation
│   │   ├── use-settings.ts        # User settings upsert + calendar setup
│   │   ├── use-recurring-tasks.ts # Recurring task template CRUD + optimistic updates
│   │   ├── use-recurring-generation.ts # Auto-generates task instances from templates
│   │   └── use-calendar-events.ts # Fetches Google Calendar events via /api/calendar/events
│   ├── emails/
│   │   └── daily-digest.tsx       # React Email template for morning digest
│   ├── lib/
│   │   ├── types.ts               # All TypeScript types/interfaces for DB entities
│   │   ├── utils.ts               # cn(), calculateProgress(), getSuggestedTasks(), date helpers
│   │   ├── scheduler.ts           # Day-scoring algorithm for auto-assigning tasks to dates
│   │   ├── recurring.ts           # getInstancesNeeded() — determines which recurring instances to create
│   │   ├── google-auth.ts         # getGoogleAccessToken() — 3-step token refresh strategy
│   │   ├── google-calendar.ts     # Google Calendar API wrapper (events CRUD, calendar list)
│   │   ├── weather.ts             # Open-Meteo geocoding + forecast (no API key)
│   │   └── supabase/
│   │       ├── client.ts          # Browser Supabase client (createBrowserClient)
│   │       ├── server.ts          # Server Component Supabase client (cookies-based)
│   │       ├── api.ts             # API Route Supabase client (same as server, separate file)
│   │       └── admin.ts           # Service-role client (bypasses RLS, used by cron)
│   └── middleware.ts              # Auth guard: redirects unauthenticated users to /login
├── supabase/
│   └── migrations/                # SQL migrations (run manually in Supabase SQL Editor)
│       ├── 001_initial_schema.sql # projects + tasks tables, RLS, realtime
│       ├── 002_settings_and_calendar.sql # user_settings, google_event_id, auto_assigned
│       ├── 003_auto_assign_setting.sql   # auto_assign_enabled column
│       ├── 004_recurring_tasks.sql       # recurring_tasks table + recurring_task_id FK
│       └── 005_digest_settings.sql       # digest_enabled, digest_city, lat/lon columns
├── vercel.json                    # Cron config: daily digest at 3 PM UTC (8 AM MST)
├── components.json                # shadcn/ui config
├── instructions.md                # Original product spec / PLD document
└── docs/plans/                    # Design docs from initial planning
```

## Key Files

| File | Why it matters |
|------|----------------|
| `src/lib/types.ts` | Single source of truth for all DB entity shapes (Task, Project, UserSettings, RecurringTask, CalendarEvent) |
| `src/lib/scheduler.ts` | Core scheduling algorithm — `scoreDays()` ranks candidate days, `pickBestDay()` selects optimal day for a task |
| `src/lib/recurring.ts` | `getInstancesNeeded()` — compares recurring templates against existing tasks to determine what to generate |
| `src/lib/google-auth.ts` | Google token refresh logic: session token -> Supabase refresh -> stored refresh token |
| `src/lib/google-calendar.ts` | All Google Calendar API calls (list calendars, get/create/update/delete events) |
| `src/hooks/use-tasks.ts` | Central task data hook used by Today, Projects, Schedule pages; includes real-time subscription |
| `src/middleware.ts` | Auth gate — every request except /login and /auth gets checked for a Supabase session |
| `src/app/auth/callback/route.ts` | Critical: stores Google refresh token after OAuth, enables long-lived calendar access |
| `src/app/api/digest/send/route.ts` | Cron endpoint: queries all digest-enabled users, fetches their tasks + weather, sends email via Resend |
| `supabase/migrations/001_initial_schema.sql` | Base schema: projects, tasks, RLS policies, realtime publication |

## Architecture & Data Flow

**Client -> Supabase (direct)**
- All CRUD for tasks, projects, settings, and recurring tasks goes directly from browser to Supabase via `@supabase/ssr` client
- RLS policies enforce `user_id` isolation — no server-side authorization needed for CRUD
- Real-time subscriptions (Postgres changes) keep UI in sync across devices

**Client -> Next.js API -> Google Calendar**
- Calendar operations proxy through API routes (`/api/calendar/*`)
- API routes use the server Supabase client to read settings/tokens, then call Google Calendar API
- Token flow: session provider_token (short-lived) -> Supabase refresh -> stored Google refresh token (long-lived)

**Vercel Cron -> API -> Supabase Admin + Resend**
- `vercel.json` triggers `/api/digest/send` daily at 3 PM UTC
- Uses admin Supabase client (service role key, bypasses RLS) to query all users
- Fetches weather from Open-Meteo, sends email via Resend

**Scheduling algorithm flow:**
1. User creates task with due date + estimated minutes
2. `pickBestDay()` in `scheduler.ts` scores each candidate day (today through due date) using weighted factors: budget fit (35%), capacity (30%), urgency (20%), spread (15%)
3. Task gets assigned to highest-scoring day
4. On Schedule page, `ScheduleButton` finds free time slots and creates Google Calendar events via best-fit bin packing

**Recurring task generation:**
1. Templates stored in `recurring_tasks` table (day of week, start/end date)
2. `useRecurringGeneration` hook runs on Schedule page mount
3. `getInstancesNeeded()` looks 2 weeks ahead, checks for existing instances by `recurring_task_id + due_date`
4. Missing instances get created as planned tasks

## "If You Need to Change X, Look at Y"

| Change | Files to modify |
|--------|----------------|
| **Add a new DB column** | Create new migration in `supabase/migrations/`, update type in `src/lib/types.ts`, update relevant hook |
| **Change task fields** | `src/lib/types.ts` (Task/TaskInsert), `src/hooks/use-tasks.ts`, `src/components/tasks/task-card.tsx` + `task-detail-dialog.tsx` + `create-task-dialog.tsx` |
| **Modify scheduling algorithm** | `src/lib/scheduler.ts` (scoreDays, pickBestDay) |
| **Change auto-assign behavior** | `src/app/(app)/schedule/page.tsx` (handleAutoAssignAll), `src/lib/scheduler.ts` |
| **Add a new page/route** | Create `src/app/(app)/<name>/page.tsx`, add to `links` array in `sidebar-nav.tsx` AND `bottom-nav.tsx` |
| **Change navigation items** | `src/components/nav/sidebar-nav.tsx` + `src/components/nav/bottom-nav.tsx` (both have a `links` array) |
| **Modify Google Calendar integration** | `src/lib/google-calendar.ts` (API calls), `src/lib/google-auth.ts` (token refresh), `src/app/api/calendar/` (API routes) |
| **Change OAuth scopes/flow** | `src/app/login/page.tsx` (scopes in signInWithOAuth), `src/app/auth/callback/route.ts` (token storage) |
| **Update daily digest email** | `src/emails/daily-digest.tsx` (template), `src/app/api/digest/send/route.ts` (data fetching + send logic) |
| **Change digest schedule** | `vercel.json` (cron schedule) |
| **Modify recurring task logic** | `src/lib/recurring.ts` (generation algorithm), `src/hooks/use-recurring-generation.ts` (trigger), `src/hooks/use-recurring-tasks.ts` (CRUD) |
| **Change how progress bars work** | `src/lib/utils.ts` (calculateProgress), `src/components/projects/progress-bar.tsx` (display) |
| **Modify task suggestions** | `src/lib/utils.ts` (getSuggestedTasks — scoring by due date + priority) |
| **Change the timeline visualization** | `src/components/schedule/day-timeline.tsx` (gap-finding, block rendering) |
| **Add/change RLS policies** | `supabase/migrations/` — create a new migration SQL file |
| **Change auth redirect behavior** | `src/middleware.ts` |
| **Modify settings UI** | `src/components/schedule/settings-panel.tsx` (form), `src/hooks/use-settings.ts` (data), `src/lib/types.ts` (UserSettings type) |
| **Add a new shadcn/ui component** | Run `npx shadcn@latest add <component>`, lands in `src/components/ui/` |
| **Change Supabase client config** | `src/lib/supabase/client.ts` (browser), `server.ts` (server components), `api.ts` (API routes), `admin.ts` (service role) |
| **Handle overdue tasks differently** | `src/components/schedule/overdue-review.tsx` |
| **Change conflict detection/rescheduling** | `src/components/schedule/conflict-reschedule.tsx` |

## Dependencies & External Services

**External services:**
- **Supabase** — Postgres DB, Auth (Google OAuth provider), Real-time subscriptions, RLS
- **Google Calendar API** — Event CRUD, free/busy, calendar list (OAuth2 with stored refresh tokens)
- **Open-Meteo** — Free weather API + geocoding (no API key needed)
- **Resend** — Email delivery for daily digest (free tier uses `onboarding@resend.dev` sender)
- **Vercel** — Hosting + serverless functions + cron jobs

**Key npm packages:**
- `@supabase/ssr` + `@supabase/supabase-js` — Supabase client for SSR/browser
- `date-fns` — Date manipulation (used everywhere)
- `radix-ui` (via shadcn/ui) — UI primitives
- `sonner` — Toast notifications
- `resend` + `@react-email/components` — Email sending + React Email templates
- `next-themes` — Theme support (installed but not actively used in visible code)
- `lucide-react` — Icons

**Environment variables:**
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public Supabase config
- `SUPABASE_SERVICE_ROLE_KEY` — Admin access (digest cron only)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth (used in token refresh)
- `RESEND_API_KEY` — Email sending
- `CRON_SECRET` — Authenticates Vercel cron requests
- `NEXT_PUBLIC_APP_URL` — App URL for email links

## Patterns & Conventions

- **All pages are client components** (`"use client"`) — no server components for pages, data fetching happens via Supabase client-side
- **Hooks pattern** — Each DB entity has a dedicated hook (`use-tasks`, `use-projects`, etc.) that handles fetch, CRUD, and real-time subscriptions
- **Optimistic updates** — `use-tasks.ts` and `use-recurring-tasks.ts` update local state immediately, roll back on error
- **Supabase client creation** — `useRef(createClient())` pattern avoids recreating the client on re-renders
- **No daily_lists table** — A "daily list" is just tasks filtered by `day = <date>`
- **Status flow** — `backlog` (no day) -> `planned` (has a day) -> `scheduled` (has google_event_id) -> `done`
- **Auto-assign** — When creating a task without a day, `pickBestDay()` automatically selects one based on capacity/priority
- **API routes only for Google Calendar** — All other data goes through Supabase client directly
- **Responsive nav** — Desktop gets sidebar (`md:flex`), mobile gets bottom tab bar (`md:hidden`)
- **Toast notifications** — `sonner` used for all user feedback (success, error, warning)
- **Date format** — `yyyy-MM-dd` strings stored in DB and used throughout; `date-fns` for all parsing/formatting
- **shadcn/ui** — UI components in `src/components/ui/` are generated by shadcn CLI; avoid editing directly
