# Design: Task Checkoff + Custom Daily Budgets

**Date:** 2026-02-23

## Feature 1: Check Off Tasks on Tasks Page

Add a checkbox to each task row on the `/tasks` page, using the same `toggleDone` logic from the Today page (`done` <-> `planned`/`backlog`). When checked, the task moves to the "completed" section at the bottom. Pencil and X buttons remain. Must work well on mobile (touch-friendly checkbox size).

## Feature 2: Day-of-Week Budget Pattern (Toggle)

### Data Model

Add to `UserSettings`:
- `custom_weekly_budgets_enabled` — Boolean, default `false`
- `budget_monday` through `budget_sunday` — nullable Integer (null = use global default)

### UI (SettingsPanel on Schedule Page)

- Add toggle: "Custom weekly budgets"
- When **off**: show the single `daily_minutes_budget` input (current behavior)
- When **on**: show 7 labeled inputs (Mon-Sun), pre-filled with the global default. Each independently settable (30-480 min). Responsive layout — stacks vertically on mobile.

### Scheduler Impact

Budget lookup checks day-of-week value when enabled, falls back to global default for null days.

## Feature 3: Specific Date Budget Override

### Data Model

New table `daily_budget_overrides`:
- `id` — String(36), UUID PK
- `user_id` — String(36), FK -> users.id
- `date` — String(10), yyyy-MM-dd, unique per user
- `minutes_budget` — Integer

### UI (Schedule Page — "Tasks on this day" card)

Editable budget field at the top of the card. Shows effective budget for that day (from whichever tier applies). Editing creates/updates an override. Clear/reset button removes override. Touch-friendly on mobile.

### API

- `GET /daily-budget-overrides/?date=YYYY-MM-DD` — get override for a date
- `PUT /daily-budget-overrides/` — upsert override `{ date, minutes_budget }`
- `DELETE /daily-budget-overrides/{date}` — remove override

## Budget Precedence

**Specific date override > day-of-week pattern (if enabled) > global default**

Single `getEffectiveBudget(date)` function in the scheduler checks tiers in order.

## Mobile Considerations

- All new UI elements must be touch-friendly (min 44px tap targets)
- Day-of-week inputs stack vertically on mobile
- Budget edit field in task card uses appropriate mobile input (number type)
- Checkbox on tasks page sized for easy tapping
