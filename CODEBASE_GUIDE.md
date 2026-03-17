# Codebase Guide — DoIt

## Project Structure

```
DoIt/
├── backend/                          # FastAPI + SQLite backend
│   ├── app/
│   │   ├── main.py                  # FastAPI app, lifespan, routers, migrations
│   │   ├── config.py                # Settings from environment (Pydantic)
│   │   ├── database.py              # SQLAlchemy engine, session, Base class
│   │   ├── deps.py                  # JWT auth, get_db(), get_current_user()
│   │   ├── models/
│   │   │   ├── user.py              # User (has tasks, projects, settings)
│   │   │   ├── task.py              # Task (status, priority, auto-assign, calendar)
│   │   │   ├── project.py           # Project (goal, definition_of_done)
│   │   │   ├── recurring_task.py    # RecurringTask (weekly/biweekly/monthly)
│   │   │   ├── user_settings.py     # UserSettings (work hours, budgets, Google tokens)
│   │   │   └── daily_budget_override.py  # Per-date budget override
│   │   ├── routers/
│   │   │   ├── auth.py              # signup, login, Google OAuth, me
│   │   │   ├── tasks.py             # CRUD + filtering by day/project/status
│   │   │   ├── projects.py          # CRUD + progress calculation
│   │   │   ├── recurring_tasks.py   # CRUD + 2-week lookahead generation
│   │   │   ├── settings.py          # get/update user settings
│   │   │   ├── calendar.py          # Google Calendar API wrapper
│   │   │   └── daily_budget_overrides.py  # Per-date budget CRUD
│   │   ├── schemas/                 # Pydantic request/response models
│   │   └── services/
│   │       ├── google_auth.py       # Google OAuth token exchange/refresh
│   │       ├── google_calendar.py   # Google Calendar CRUD
│   │       └── ical_service.py      # iCal parsing for multi-calendar
│   ├── scripts/
│   │   └── migrate_from_supabase.py # One-time Supabase migration
│   ├── Dockerfile
│   └── requirements.txt
│
├── src/                             # Next.js 16 frontend (App Router)
│   ├── app/
│   │   ├── layout.tsx               # Root layout, AuthProvider, theme
│   │   ├── page.tsx                 # Home → redirect to /today
│   │   ├── login/page.tsx           # Login/signup form
│   │   ├── api/backend/[...path]/route.ts  # Proxy to FastAPI
│   │   └── (app)/                   # Protected routes
│   │       ├── layout.tsx           # Auth guard, NavWrapper
│   │       ├── today/page.tsx       # Today's tasks + suggested
│   │       ├── tasks/page.tsx       # All tasks, filter by project/status
│   │       ├── projects/
│   │       │   ├── page.tsx         # Project list + progress bars
│   │       │   └── [id]/page.tsx    # Project detail + tasks
│   │       ├── schedule/page.tsx    # Day timeline, auto-assign, calendar
│   │       ├── settings/page.tsx    # Work hours, budgets, Google OAuth, recurring
│   │       ├── overdue/page.tsx     # Overdue task review
│   │       └── help/page.tsx        # Help + keyboard shortcuts
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives
│   │   ├── nav/                     # TopNav, SideNav, BottomNav
│   │   ├── tasks/                   # TaskCard, CreateTask, TaskDetail dialogs
│   │   ├── projects/                # ProjectCard, ProgressBar, CreateProject
│   │   ├── schedule/                # DayTimeline, ScheduleButton, ConflictReschedule
│   │   ├── daily/                   # DateSelector, SuggestedTasks
│   │   └── settings/               # RecurringTaskDialog, RecurringTasksSection
│   ├── hooks/
│   │   ├── use-tasks.ts             # useTasks(day) → CRUD + toggle-done
│   │   ├── use-projects.ts          # useProjects() → list with progress
│   │   ├── use-settings.ts          # useSettings() → get/update
│   │   ├── use-calendar-events.ts   # useCalendarEvents(start, end)
│   │   ├── use-recurring-tasks.ts   # useRecurringTasks()
│   │   └── use-recurring-generation.ts  # Auto-generate recurring instances
│   └── lib/
│       ├── api.ts                   # Typed API client (all endpoints)
│       ├── auth-context.tsx         # AuthProvider, useAuth(), JWT in localStorage
│       ├── types.ts                 # TypeScript interfaces
│       ├── scheduler.ts             # Smart scheduling: pickBestDay, rebalance
│       └── utils.ts                 # Date formatting, helpers
│
├── CLAUDE.md                        # Project setup + API docs
├── Dockerfile                       # Next.js multi-stage build
├── package.json
├── instructions.md                  # Feature specs
└── docs/plans/                      # Planning docs
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app setup, CORS, routers, lifespan migrations |
| `backend/app/deps.py` | JWT extraction, user lookup, DB session injection |
| `backend/app/models/*.py` | SQLAlchemy ORM: User, Task, Project, RecurringTask, UserSettings |
| `backend/app/routers/tasks.py` | Task CRUD with day/project/status filtering |
| `backend/app/services/google_calendar.py` | Create/update/delete Google Calendar events |
| `src/lib/api.ts` | Typed fetch wrapper for all backend endpoints |
| `src/lib/auth-context.tsx` | JWT in localStorage, login/logout/refreshUser |
| `src/lib/scheduler.ts` | Smart scheduling: capacity, budget, urgency scoring |
| `src/lib/types.ts` | TypeScript interfaces (Task, Project, etc.) |
| `src/hooks/use-tasks.ts` | Query/create/update/delete tasks |
| `src/app/(app)/schedule/page.tsx` | Day timeline, auto-assign, calendar events |

## Architecture & Data Flow

### Auth
```
signup/login → POST /auth → bcrypt hash → JWT returned
JWT stored in localStorage → Bearer token on all requests
get_current_user() dependency validates JWT → returns User
```

### Task Lifecycle
```
Create task (backlog) → POST /tasks → status="backlog"
Auto-assign → pickBestDay() scores days by capacity/urgency → status="planned"
Schedule to calendar → POST /calendar/events → stores google_event_id
Mark done → PUT /tasks/{id} {status: "done"}
```

### Smart Scheduling (frontend `scheduler.ts`)
```
pickBestDay(task, allTasks, calendarEvents, settings):
  For each day in range:
    - Calculate budget (working hours - events - existing tasks)
    - Score by spread, capacity, urgency, due date proximity
  Return highest-scoring day
rebalanceAutoAssigned() → re-runs pickBestDay for all auto-assigned tasks
```

### Recurring Task Generation
```
POST /recurring-tasks/generate → scans 2 weeks ahead
Weekly: one instance per week on target day
Biweekly: anchored to start_date, every 2 weeks
Monthly: same day-of-month each month
```

### Google Calendar Integration
```
Connect → GET /auth/google → OAuth URL → user authorizes
POST /auth/google/callback → stores refresh_token
POST /calendar/setup → finds/creates "DoIt" calendar
Task scheduled → POST /calendar/events → creates event
Calendar events block time capacity on schedule page
```

## "If You Need to Change X, Look at Y"

| Feature | Backend | Frontend |
|---------|---------|----------|
| Task CRUD | `routers/tasks.py` | `hooks/use-tasks.ts`, `components/tasks/` |
| Auto-assignment | — | `lib/scheduler.ts` |
| Project progress | `routers/projects.py` | `hooks/use-projects.ts`, `components/projects/` |
| Recurring tasks | `routers/recurring_tasks.py` | `hooks/use-recurring-generation.ts` |
| Google Calendar | `services/google_calendar.py`, `routers/calendar.py` | `hooks/use-calendar-events.ts` |
| Auth/JWT | `routers/auth.py`, `deps.py` | `lib/auth-context.tsx` |
| Settings | `models/user_settings.py`, `routers/settings.py` | `hooks/use-settings.ts` |
| Database schema | `models/*.py` | — |
| API types | `schemas/*.py` | `lib/types.ts` |
| API proxy | — | `app/api/backend/[...path]/route.ts` |

## Dependencies & External Services

**Backend**: FastAPI, SQLAlchemy (SQLite), python-jose (JWT), bcrypt, icalendar, httpx
**Frontend**: Next.js 16, React 19, Tailwind v4, shadcn/ui, date-fns, lucide-react, sonner
**External**: Google Calendar API, Google OAuth 2.0

## Patterns & Conventions

- **Auth**: JWT in localStorage, Bearer token on all requests
- **State**: React hooks per page (no Redux), refetch-after-mutation
- **DB**: All tables have `id` (UUID), `created_at`, `updated_at`; data siloed by `user_id`
- **API**: snake_case responses, 204 for deletes, standard error format
- **Styling**: shadcn/ui components + Tailwind utility classes
