# DoIt Handoff

**Date:** 2026-02-19
**Branch:** main (up to date with origin)

## What Was Done This Session

### Complete rewrite: Supabase → self-hosted FastAPI + SQLite

All 4 phases of the migration plan implemented in one session:

**Phase 1: Backend Scaffold**
- Created `backend/` with FastAPI app following MacroNotion pattern
- Models: User, Task, Project, RecurringTask, UserSettings (all string UUID PKs)
- Routers: auth (signup/login/me + Google OAuth), tasks, projects, recurring_tasks, settings, calendar
- Services: Google auth (token exchange/refresh), Google Calendar API wrapper
- JWT auth with bcrypt password hashing

**Phase 2: Frontend Rewire**
- Created `src/lib/api.ts` — typed API helper with all endpoints
- Created `src/lib/auth-context.tsx` — JWT auth context (localStorage)
- Created `src/app/api/backend/[...path]/route.ts` — proxy to FastAPI
- Rewrote all hooks to use api.* calls (removed Supabase + real-time)
- Rewrote login page (email/password instead of Google OAuth)
- Removed all Supabase, Resend, React Email dependencies

**Phase 3: Google Calendar Integration**
- Backend services: google_auth.py, google_calendar.py + calendar.py router
- Auth router: Google OAuth connect/disconnect routes
- Settings page: handles OAuth callback (?google=callback&code=...)

**Phase 4: Docker + Deploy**
- Frontend + backend Dockerfiles
- Updated homelab docker-compose.yml
- Migration script: backend/scripts/migrate_from_supabase.py
- Updated CLAUDE.md with new architecture

### Files Deleted
- `src/lib/supabase/` (entire directory)
- `src/app/auth/callback/`, `src/app/api/calendar/`, `src/app/api/digest/`, `src/emails/`
- `src/lib/google-auth.ts`, `google-calendar.ts`, `weather.ts`, `recurring.ts`
- `supabase/` (migrations directory), `vercel.json`

## Current State

- All code committed and pushed to GitHub
- Homelab docker-compose.yml updated (committed locally, homelab has no remote)
- NOT YET DEPLOYED — containers haven't been built/started

## To Deploy

```bash
cd ~/Downloads/Projects/homelab
# Generate a secret key if not already in .env:
# python -c "import secrets; print(secrets.token_hex(32))"
docker compose up -d --build doit-backend doit
```

## Known Items

- Google OAuth redirect URI uses `localhost:3003` (Google blocks .homelab TLDs)
- No real-time sync — refetch-after-mutation pattern
- Existing Supabase data can be migrated with `backend/scripts/migrate_from_supabase.py`
- Users will need new passwords after migration (Supabase auth hashes aren't portable)

## Next Steps

1. Deploy and smoke-test all features
2. Optionally migrate data from Supabase
3. Add the pencil edit button to the `/tasks` page task list
4. Consider adding LLM-assisted planning (milestone from original roadmap)
