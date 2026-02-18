# DoIt

A calm, single-user daily list + project backlog system with Google Calendar scheduling (future) and LLM-assisted planning (future).

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: Supabase (Postgres, Auth, Real-Time)
- **Auth**: Google OAuth via Supabase
- **Hosting**: Vercel + Supabase

## Setup

1. Clone: `git clone https://github.com/standw7/DoIt.git`
2. Install: `npm install`
3. Copy `.env.local.example` to `.env.local` and fill in Supabase credentials
4. Run the SQL migration from `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor
5. Run: `npm run dev`
6. Open http://localhost:3000

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key

## Architecture

- Client talks to Supabase directly (no custom API routes for CRUD)
- Row-Level Security (RLS) enforces single-user data isolation
- Real-time subscriptions for cross-device sync
- No separate daily_lists table — daily list = tasks where `day = <date>`
- Route group `(app)` wraps authenticated pages with responsive navigation

## Key Files

- `src/app/(app)/today/page.tsx` — Daily list view with date selector and suggestions
- `src/app/(app)/projects/page.tsx` — Projects list with progress bars
- `src/app/(app)/projects/[id]/page.tsx` — Project detail with task CRUD
- `src/app/login/page.tsx` — Google OAuth login
- `src/hooks/use-tasks.ts` — Task CRUD + real-time subscriptions
- `src/hooks/use-projects.ts` — Project CRUD + real-time subscriptions
- `src/lib/types.ts` — TypeScript types for all database entities
- `src/lib/utils.ts` — Progress calculation, suggestion logic, date helpers
- `src/middleware.ts` — Auth session refresh + redirect unauthenticated users
- `supabase/migrations/` — Database schema with RLS

## Milestones

1. **MVP core** (current) — Projects, tasks, daily lists, progress bars, suggestions
2. Calendar read-only — OAuth + free/busy view
3. Scheduling preview — Generate plan without writing events
4. Calendar write — Commit events + idempotency + undo
5. LLM import/export — Export prompt payload, import JSON + validation
