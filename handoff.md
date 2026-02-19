# DoIt Handoff

**Date:** 2026-02-18
**Branch:** main (up to date with origin)

## What Was Done This Session

### 1. Fixed recurring task creation bug
- Root cause: migration `004_recurring_tasks.sql` was never applied to Supabase
- Fix: ran the migration SQL in Supabase SQL Editor
- Verified: POST to `recurring_tasks` returns 201

### 2. Set up Supabase CLI
- Installed via Homebrew (v2.75.0)
- Linked to project: `supabase link --project-ref dopbsgnhbwtahoaxzxrn`
- Ran `supabase init` (created `supabase/config.toml`)

### 3. Set up Vercel deployment
- Installed Vercel CLI (v50.19.1)
- Project linked as `doit-app`
- Production URL: **https://getdoit.vercel.app** (alias) / https://doit-app-alpha.vercel.app
- GitHub repo connected for auto-deploys
- Supabase auth redirect URLs updated via Management API to allow both localhost and Vercel URLs

### 4. Task editing + optimistic updates
- Recurring tasks can now be edited (click row to open edit dialog)
- Pencil icon added to TaskCard for one-time task editing
- Optimistic updates in `use-tasks.ts` and `use-recurring-tasks.ts` (instant UI, rollback on error)
- Duplicate toast removed from TaskDetailDialog

### 5. Daily digest email feature (NEW)
- **Settings UI**: Daily Digest card on settings page with toggle + city input with Open-Meteo geocoding
- **Weather utility**: `src/lib/weather.ts` — geocoding + forecast via Open-Meteo (free, no key)
- **Email template**: `src/emails/daily-digest.tsx` — React Email HTML template with weather, tasks, priority dots
- **API route**: `/api/digest/send` — Vercel cron triggers daily, queries tasks, fetches weather, sends via Resend
- **Supabase admin client**: `src/lib/supabase/admin.ts` — service role key client for cron routes
- **Vercel cron**: `vercel.json` — fires at 8 AM MST (3 PM UTC) daily
- **Database migration**: `005_digest_settings.sql` — added `digest_enabled`, `digest_city`, `digest_latitude`, `digest_longitude` to `user_settings`

## Environment Variables on Vercel

| Variable | Set? |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `RESEND_API_KEY` | Yes |
| `CRON_SECRET` | Yes |
| `NEXT_PUBLIC_APP_URL` | Yes |

## Current State

- All code pushed to GitHub, deployed to Vercel
- Daily digest uses `onboarding@resend.dev` as sender (Resend free tier limitation — switch to custom domain sender when a domain is purchased)
- The `/tasks` page renders one-time tasks as raw `<div>` elements (not `TaskCard`), so the pencil edit icon only appears on the Today page and Project detail pages

## Nothing In-Flight

All planned work is complete. No pending PRs or unfinished features.

## Next Steps (ideas, not in progress)

- Buy a custom domain and configure in Vercel + Resend for proper email sender
- Add the pencil edit button to the `/tasks` page task list
- Calendar integration (milestone 2-4 from CLAUDE.md)
