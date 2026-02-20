# DoIt

A calm, single-user daily list + project backlog system with Google Calendar scheduling and auto-assignment.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: FastAPI + SQLite (self-hosted)
- **Auth**: Email/password + JWT
- **Calendar**: Google Calendar API (optional connect)
- **Hosting**: Docker Compose on homelab (tasks.homelab)

## Architecture

```
Browser → tasks.homelab → Caddy → doit:3000 (Next.js frontend)
                                     ↓ /api/backend/* proxy
                                   doit-backend:8000 (FastAPI + SQLite)
                                     ↓ (optional)
                                   Google Calendar API
```

- Frontend proxies API calls through `/api/backend/[...path]` route to the FastAPI backend
- JWT auth stored in localStorage, sent as Bearer token
- No real-time — refetch-after-mutation pattern
- Server-side progress calculation for projects
- Server-side recurring task generation

## Setup (Development)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env  # edit with your secrets
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
npm install
cp .env.local.example .env.local  # BACKEND_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000, sign up with email/password.

## Setup (Docker / Homelab)

Services are defined in the homelab `docker-compose.yml`:
- `doit-backend`: FastAPI + SQLite, volume `doit_db`
- `doit`: Next.js frontend, port 3003

```bash
cd ~/Downloads/Projects/homelab
docker compose up -d --build doit-backend doit
```

### Environment Variables

**Backend (doit-backend):**
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite path (e.g. `sqlite:////app/data/doit.db`) |
| `SECRET_KEY` | JWT signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (for calendar) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `FRONTEND_URL` | Frontend URL for CORS |

**Frontend (doit):**
| Variable | Purpose |
|----------|---------|
| `BACKEND_URL` | Internal URL to backend (e.g. `http://doit-backend:8000`) |

## API Endpoints

```
POST /auth/signup          → JWT
POST /auth/login           → JWT
GET  /auth/me              → User
GET  /auth/google          → { url } (OAuth start)
POST /auth/google/callback → exchange code for tokens
DELETE /auth/google         → disconnect calendar

GET/POST        /tasks/              → Task CRUD
PUT/DELETE      /tasks/{id}

GET/POST        /projects/           → Project CRUD (includes progress)
PUT/DELETE      /projects/{id}

GET/POST        /recurring-tasks/    → RecurringTask CRUD
PUT/DELETE      /recurring-tasks/{id}
POST            /recurring-tasks/generate → create instances

GET/PUT         /settings/           → UserSettings (upsert)

GET             /calendar/events     → list events
POST            /calendar/events     → create event
PATCH           /calendar/events/{id} → update event
DELETE          /calendar/events/{id} → delete event
POST            /calendar/setup      → find/create DoIt calendar
```

## Key Files

### Backend (`backend/app/`)
- `config.py` — Pydantic settings (env vars)
- `database.py` — SQLAlchemy engine + session
- `deps.py` — get_db() + get_current_user() (JWT)
- `main.py` — FastAPI app with CORS + routers
- `models/` — SQLAlchemy models (User, Task, Project, RecurringTask, UserSettings)
- `schemas/` — Pydantic request/response models
- `routers/` — API routes (auth, tasks, projects, recurring_tasks, settings, calendar)
- `services/` — Google auth + calendar API wrappers

### Frontend (`src/`)
- `app/api/backend/[...path]/route.ts` — Proxy to FastAPI backend
- `lib/api.ts` — Typed API helper (all endpoints)
- `lib/auth-context.tsx` — JWT auth context (localStorage)
- `hooks/` — React hooks wrapping API calls
- `app/(app)/` — Authenticated pages (today, tasks, projects, schedule, settings, help)
- `components/` — UI components (task cards, schedule timeline, etc.)

## Google Calendar Connect Flow

1. User clicks "Connect Calendar" in Settings
2. Frontend calls `GET /auth/google` → gets Google OAuth URL
3. User authorizes → redirected back to `/settings?google=callback&code=...`
4. Frontend exchanges code via `POST /auth/google/callback`
5. Backend stores refresh_token in user_settings
6. Frontend calls `POST /calendar/setup` → creates/finds "DoIt" calendar
7. Calendar events now appear on Schedule page

## Data Migration

One-time script to migrate from Supabase Postgres to local SQLite:
```bash
cd backend
SUPABASE_DB_URL="postgresql://..." python scripts/migrate_from_supabase.py
```
Note: Users will need to create new passwords after migration.
