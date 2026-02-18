# Intelligent Scheduling + Calendar Integration Design

## Overview

Expand task creation with due dates and estimated time, add Google Calendar read/write integration, and implement score-based automatic day assignment for tasks without a manually chosen day.

## Decisions

- **Calendar scope**: Read + Write (full `calendar` scope)
- **Auto-assign UX**: Silent assignment, user can move later
- **Working hours**: Configurable via settings page
- **Calendar target**: Dedicated "DoIt Tasks" calendar, auto-created on first use
- **Algorithm**: Score-based day assignment (weighted scoring across 4 factors)

## 1. Expanded Task Creation Form

Replace inline text input with a dialog collecting:

- **Name** (required) — text, max 80 chars
- **Due date** (required) — date picker
- **Day** (optional) — date picker, labeled "Schedule for day (leave blank for auto-assign)"
- **Estimated time** (required) — preset buttons: 15m, 30m, 45m, 1h, 2h, custom
- **Priority** — low / medium / high toggle, default medium
- **Description** (optional) — textarea behind "Add details" link

When submitted with no day, the scoring algorithm auto-assigns a day. Auto-assigned tasks show a small "auto" badge on the daily list.

Used in both project detail ("Add task" under project) and daily list ("Add task" with day pre-filled).

## 2. Google Calendar Integration

### OAuth

- Add `calendar` scope to existing Google OAuth sign-in via Supabase
- Supabase stores `provider_token` and `provider_refresh_token` in the session
- API routes use these tokens server-side to call Google Calendar API

### API Routes

| Route | Method | Purpose |
|---|---|---|
| /api/calendar/events | GET | Fetch events for a day or date range |
| /api/calendar/events | POST | Create a calendar event for a task |
| /api/calendar/events/[eventId] | DELETE | Remove a DoIt-created event |
| /api/calendar/setup | POST | Create "DoIt Tasks" calendar if not exists |

### Dedicated DoIt Calendar

- Created on first use, named "DoIt Tasks" with distinct color
- Calendar ID stored in `user_settings.doit_calendar_id`
- Events include: task name as title, description with task details, task ID in extended properties

### Token Refresh

- Access tokens expire after 1 hour
- API routes check validity, use refresh token for new access token
- Store refreshed token back via Supabase

## 3. Score-Based Day Assignment Algorithm

When a task is created without a day, score every candidate day and pick the best.

### Candidate Days

- Tomorrow through `due_date - 1` (or 14 days out if no due date)

### Scoring Factors

**Due date proximity (weight: 35%)**
- Higher scores for days closer to due date, leaving a buffer day
- `score = 100 - (days_until_due - days_until_candidate) * (100 / days_until_due)`

**Available capacity (weight: 30%)**
- `free_minutes = working_hours - calendar_events - assigned_task_minutes`
- `score = (free_minutes / working_hours_minutes) * 100`
- Score = 0 if task doesn't fit (free_minutes < estimated_minutes)

**Workload balance (weight: 20%)**
- Ideal day: 1-2 tasks over 45min + several tasks under 30min
- Score higher when adding this task moves the day closer to ideal mix
- Penalize days with too many long tasks or too many total tasks

**Priority boost (weight: 15%)**
- High priority: prefer earlier days (score decreases further out)
- Low priority: prefer later days (more flexibility)
- Medium: flat score across candidates

### Edge Cases

- **No due date**: 14-day window, priority weight increases
- **No calendar connected**: Uses only assigned task durations for capacity
- **No available days**: Assign to the day with the most remaining capacity, even if over budget, and show a warning

### Final Score

Weighted sum of all factors. Ties broken by earlier date.

## 4. User Settings & Schedule Page

### New Table: user_settings

| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | gen_random_uuid() |
| user_id | UUID (FK) | → auth.users, UNIQUE, NOT NULL |
| working_hours_start | TIME | default '09:00' |
| working_hours_end | TIME | default '17:00' |
| daily_minutes_budget | INTEGER | default 120 |
| doit_calendar_id | TEXT | Google Calendar ID, nullable |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

RLS: `WHERE user_id = auth.uid()` on all operations.

### New Task Field

Add `google_event_id TEXT` to the tasks table for calendar event tracking.

### Settings UI

Accessible from the Schedule page:
- Working hours: start/end time pickers
- Daily task budget: input (30-480 minutes)
- Google Calendar: "Connect Calendar" button, shows connected status

### Schedule Page

Replaces "Coming soon" placeholder:
- Settings section at top
- Day schedule timeline: calendar events + scheduled tasks
- "Schedule my day" button: writes task blocks to Google Calendar for planned tasks without an event

### Calendar Event Creation

- Event title: task name
- Event description: task description + DoIt link
- Duration: estimated_minutes
- Placed in free slots (longest free slots first, respect working hours)
- `google_event_id` stored on task record for idempotency and undo

## Database Migration (002)

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

-- Enable realtime on settings
ALTER PUBLICATION supabase_realtime ADD TABLE user_settings;
```
