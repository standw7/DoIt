# Daily Digest Email Design

**Date:** 2026-02-18
**Status:** Approved

## Problem

Users have no way to see their upcoming tasks for the day without opening the app. A morning email digest would give a quick overview of what's planned, how long it'll take, and what the weather looks like — all before they start their day.

## Solution

### Email Delivery

Send a daily HTML email at a fixed time (7 AM user's local time, configured as UTC cron) using Resend. Free tier supports 100 emails/day. The email is a React component rendered with `@react-email/components`.

### Weather

Use Open-Meteo (free, no API key) for daily forecasts. The user enters a city name in settings, which is geocoded to lat/lon via Open-Meteo's geocoding API and stored in `user_settings`. Each morning, fetch the forecast using the stored coordinates.

### Data Model

Add four columns to `user_settings`:
- `digest_enabled` (boolean, default false)
- `digest_city` (text, nullable)
- `digest_latitude` (double precision, nullable)
- `digest_longitude` (double precision, nullable)

No new tables. User email comes from Supabase `auth.users`.

### Settings UI

Add a "Daily Digest" card to the settings page:
- Toggle to enable/disable
- City text input with a "Verify" button that geocodes and shows resolved location
- Coordinates auto-saved on successful geocode

### API Route: `/api/digest/send`

Vercel cron triggers this route daily. Protected by `CRON_SECRET` env var. Flow:
1. Query users with `digest_enabled = true`
2. For each user: fetch tasks where `day = today` and `status != 'done'`
3. Fetch weather from Open-Meteo using stored lat/lon
4. Get email from `auth.users`
5. Render React email template, send via Resend

### Email Content

- Greeting with date
- Weather card: city, high/low temp (F), precipitation chance, weather condition
- Task list sorted by priority, each showing: priority indicator, name, estimated time, description snippet
- Total time commitment
- Link to open the app

### Dependencies

- `resend` — email API
- `@react-email/components` — HTML email rendering

### Vercel Cron

```json
{
  "crons": [{
    "path": "/api/digest/send",
    "schedule": "0 13 * * *"
  }]
}
```

## Out of Scope

- Per-user send times
- Digest history or resend
- Weekly summaries
- Customizing which tasks appear
