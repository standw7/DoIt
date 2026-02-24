# Task Checkoff + Custom Daily Budgets — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add task checkoff to the tasks page, day-of-week budget patterns with toggle, and per-date budget overrides from the schedule page.

**Architecture:** Three features layered bottom-up: backend model changes first, then API endpoints, then frontend UI. The scheduler's budget lookup becomes a `getEffectiveBudget()` function that checks date override > day-of-week > global default. All UI must be mobile-friendly.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Next.js + TypeScript + shadcn/ui (frontend), SQLite (database)

---

### Task 1: Add checkbox to tasks page

**Files:**
- Modify: `src/app/(app)/tasks/page.tsx`

**Step 1: Add toggle handler**

In `TasksPage`, add a `handleToggleDone` function after `handleDeleteTask` (line ~112):

```tsx
async function handleToggleDone(task: Task) {
  const newStatus = task.status === "done" ? (task.day ? "planned" : "backlog") : "done";
  try {
    await api.updateTask(task.id, { status: newStatus });
    await fetchAllTasks();
  } catch {
    // ignore
  }
}
```

**Step 2: Add Checkbox import**

Add to imports (line 17):
```tsx
import { Checkbox } from "@/components/ui/checkbox";
```

**Step 3: Add checkbox to active task rows**

In the active task row `div` (lines 211-264), add a Checkbox as the first child inside the outer flex div, before the `<div className="min-w-0">`:

```tsx
<div
  key={task.id}
  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
>
  <Checkbox
    checked={false}
    onCheckedChange={() => handleToggleDone(task)}
    className="h-5 w-5 shrink-0"
  />
  <div className="min-w-0 flex-1">
    {/* existing name + metadata */}
  </div>
  <div className="flex items-center gap-1 shrink-0 ml-2">
    {/* existing buttons */}
  </div>
</div>
```

**Step 4: Add checkbox to completed task rows**

In the completed tasks section (lines 277-288), add a checked Checkbox and the toggle handler:

```tsx
<div
  key={task.id}
  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground"
>
  <Checkbox
    checked={true}
    onCheckedChange={() => handleToggleDone(task)}
    className="h-5 w-5 shrink-0"
  />
  <span className="line-through flex-1">{task.name}</span>
  <Badge variant="outline" className="text-xs">
    {task.status}
  </Badge>
</div>
```

**Step 5: Commit**

```bash
git add src/app/\(app\)/tasks/page.tsx
git commit -m "feat: add task checkoff checkboxes to tasks page"
```

---

### Task 2: Add weekly budget fields to backend UserSettings model

**Files:**
- Modify: `backend/app/models/user_settings.py`

**Step 1: Add new columns**

After `skip_weekends` (line 23), add:

```python
custom_weekly_budgets_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
budget_monday: Mapped[int | None] = mapped_column(Integer, nullable=True)
budget_tuesday: Mapped[int | None] = mapped_column(Integer, nullable=True)
budget_wednesday: Mapped[int | None] = mapped_column(Integer, nullable=True)
budget_thursday: Mapped[int | None] = mapped_column(Integer, nullable=True)
budget_friday: Mapped[int | None] = mapped_column(Integer, nullable=True)
budget_saturday: Mapped[int | None] = mapped_column(Integer, nullable=True)
budget_sunday: Mapped[int | None] = mapped_column(Integer, nullable=True)
```

**Step 2: Commit**

```bash
git add backend/app/models/user_settings.py
git commit -m "feat: add weekly budget fields to UserSettings model"
```

---

### Task 3: Add weekly budget fields to backend schemas

**Files:**
- Modify: `backend/app/schemas/settings.py`

**Step 1: Add fields to SettingsUpdate**

```python
custom_weekly_budgets_enabled: bool | None = None
budget_monday: int | None = None
budget_tuesday: int | None = None
budget_wednesday: int | None = None
budget_thursday: int | None = None
budget_friday: int | None = None
budget_saturday: int | None = None
budget_sunday: int | None = None
```

**Step 2: Add fields to SettingsResponse**

```python
custom_weekly_budgets_enabled: bool
budget_monday: int | None = None
budget_tuesday: int | None = None
budget_wednesday: int | None = None
budget_thursday: int | None = None
budget_friday: int | None = None
budget_saturday: int | None = None
budget_sunday: int | None = None
```

**Step 3: Commit**

```bash
git add backend/app/schemas/settings.py
git commit -m "feat: add weekly budget fields to settings schemas"
```

---

### Task 4: Add migration for weekly budget columns

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add migration in `_run_migrations()`**

After the `skip_weekends` migration block (lines 16-21), add:

```python
if "user_settings" in inspector.get_table_names():
    columns = {c["name"] for c in inspector.get_columns("user_settings")}
    if "custom_weekly_budgets_enabled" not in columns:
        conn.execute(text(
            "ALTER TABLE user_settings ADD COLUMN custom_weekly_budgets_enabled BOOLEAN DEFAULT 0 NOT NULL"
        ))
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]:
        col = f"budget_{day}"
        if col not in columns:
            conn.execute(text(
                f"ALTER TABLE user_settings ADD COLUMN {col} INTEGER"
            ))
```

**Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add migration for weekly budget columns"
```

---

### Task 5: Create DailyBudgetOverride backend model

**Files:**
- Create: `backend/app/models/daily_budget_override.py`
- Modify: `backend/app/models/__init__.py`

**Step 1: Create the model file**

```python
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DailyBudgetOverride(Base):
    __tablename__ = "daily_budget_overrides"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False, index=True
    )
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    minutes_budget: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship()  # noqa: F821
```

**Step 2: Register in `__init__.py`**

Add import and to `__all__`:
```python
from app.models.daily_budget_override import DailyBudgetOverride
```

Add `"DailyBudgetOverride"` to `__all__`.

**Step 3: Commit**

```bash
git add backend/app/models/daily_budget_override.py backend/app/models/__init__.py
git commit -m "feat: add DailyBudgetOverride model"
```

---

### Task 6: Create DailyBudgetOverride schemas and router

**Files:**
- Create: `backend/app/schemas/daily_budget_override.py`
- Create: `backend/app/routers/daily_budget_overrides.py`
- Modify: `backend/app/main.py`

**Step 1: Create schemas**

```python
from datetime import datetime

from pydantic import BaseModel


class DailyBudgetOverrideUpsert(BaseModel):
    date: str
    minutes_budget: int


class DailyBudgetOverrideResponse(BaseModel):
    id: str
    user_id: str
    date: str
    minutes_budget: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

**Step 2: Create router**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models.user import User
from app.models.daily_budget_override import DailyBudgetOverride
from app.schemas.daily_budget_override import DailyBudgetOverrideResponse, DailyBudgetOverrideUpsert

router = APIRouter(prefix="/daily-budget-overrides", tags=["daily-budget-overrides"])


@router.get("/", response_model=DailyBudgetOverrideResponse | None)
def get_override(
    date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = (
        db.query(DailyBudgetOverride)
        .filter(
            DailyBudgetOverride.user_id == current_user.id,
            DailyBudgetOverride.date == date,
        )
        .first()
    )
    return override


@router.get("/range", response_model=list[DailyBudgetOverrideResponse])
def get_overrides_range(
    start: str,
    end: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(DailyBudgetOverride)
        .filter(
            DailyBudgetOverride.user_id == current_user.id,
            DailyBudgetOverride.date >= start,
            DailyBudgetOverride.date <= end,
        )
        .all()
    )


@router.put("/", response_model=DailyBudgetOverrideResponse)
def upsert_override(
    body: DailyBudgetOverrideUpsert,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = (
        db.query(DailyBudgetOverride)
        .filter(
            DailyBudgetOverride.user_id == current_user.id,
            DailyBudgetOverride.date == body.date,
        )
        .first()
    )
    if override:
        override.minutes_budget = body.minutes_budget
    else:
        override = DailyBudgetOverride(
            user_id=current_user.id,
            date=body.date,
            minutes_budget=body.minutes_budget,
        )
        db.add(override)
    db.commit()
    db.refresh(override)
    return override


@router.delete("/{date}")
def delete_override(
    date: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    override = (
        db.query(DailyBudgetOverride)
        .filter(
            DailyBudgetOverride.user_id == current_user.id,
            DailyBudgetOverride.date == date,
        )
        .first()
    )
    if not override:
        raise HTTPException(status_code=404, detail="No override for that date")
    db.delete(override)
    db.commit()
    return {"ok": True}
```

**Step 3: Register router in `main.py`**

Add import:
```python
from app.routers import daily_budget_overrides
```

Add router inclusion:
```python
app.include_router(daily_budget_overrides.router)
```

**Step 4: Commit**

```bash
git add backend/app/schemas/daily_budget_override.py backend/app/routers/daily_budget_overrides.py backend/app/main.py
git commit -m "feat: add daily budget override API endpoints"
```

---

### Task 7: Add frontend types and API functions for new features

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`

**Step 1: Update UserSettings type**

Add to `UserSettings` interface after `skip_weekends`:
```ts
custom_weekly_budgets_enabled: boolean;
budget_monday: number | null;
budget_tuesday: number | null;
budget_wednesday: number | null;
budget_thursday: number | null;
budget_friday: number | null;
budget_saturday: number | null;
budget_sunday: number | null;
```

**Step 2: Add DailyBudgetOverride type**

```ts
export interface DailyBudgetOverride {
  id: string;
  user_id: string;
  date: string;
  minutes_budget: number;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Add API functions**

Add to `api.ts`:
```ts
// ── Daily Budget Overrides ──────────────────────────────────

export async function getDailyBudgetOverride(date: string): Promise<DailyBudgetOverride | null> {
  return request(`/daily-budget-overrides/?date=${date}`);
}

export async function getDailyBudgetOverridesRange(start: string, end: string): Promise<DailyBudgetOverride[]> {
  return request(`/daily-budget-overrides/range?start=${start}&end=${end}`);
}

export async function upsertDailyBudgetOverride(date: string, minutesBudget: number): Promise<DailyBudgetOverride> {
  return request("/daily-budget-overrides/", {
    method: "PUT",
    body: JSON.stringify({ date, minutes_budget: minutesBudget }),
  });
}

export async function deleteDailyBudgetOverride(date: string): Promise<void> {
  return request(`/daily-budget-overrides/${date}`, { method: "DELETE" });
}
```

**Step 4: Update DailyBudgetOverride import in api.ts**

Add `DailyBudgetOverride` to the import from `./types`.

**Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/api.ts
git commit -m "feat: add frontend types and API for budget overrides"
```

---

### Task 8: Update use-settings hook with weekly budget fields

**Files:**
- Modify: `src/hooks/use-settings.ts`

**Step 1: Add weekly budget defaults to `DEFAULT_SETTINGS`**

```ts
custom_weekly_budgets_enabled: false,
budget_monday: null as number | null,
budget_tuesday: null as number | null,
budget_wednesday: null as number | null,
budget_thursday: null as number | null,
budget_friday: null as number | null,
budget_saturday: null as number | null,
budget_sunday: null as number | null,
```

**Step 2: Add to `effectiveSettings`**

```ts
custom_weekly_budgets_enabled: settings?.custom_weekly_budgets_enabled ?? DEFAULT_SETTINGS.custom_weekly_budgets_enabled,
budget_monday: settings?.budget_monday ?? null,
budget_tuesday: settings?.budget_tuesday ?? null,
budget_wednesday: settings?.budget_wednesday ?? null,
budget_thursday: settings?.budget_thursday ?? null,
budget_friday: settings?.budget_friday ?? null,
budget_saturday: settings?.budget_saturday ?? null,
budget_sunday: settings?.budget_sunday ?? null,
```

**Step 3: Commit**

```bash
git add src/hooks/use-settings.ts
git commit -m "feat: add weekly budget fields to settings hook"
```

---

### Task 9: Create getEffectiveBudget function in scheduler

**Files:**
- Modify: `src/lib/scheduler.ts`

**Step 1: Add the function**

Add after the `getDayEventMinutes` function:

```ts
/**
 * Get the effective budget for a given date.
 * Precedence: date override > day-of-week pattern > global default.
 */
export function getEffectiveBudget(
  dateStr: string,
  globalBudget: number,
  weeklyBudgets?: {
    enabled: boolean;
    monday: number | null;
    tuesday: number | null;
    wednesday: number | null;
    thursday: number | null;
    friday: number | null;
    saturday: number | null;
    sunday: number | null;
  } | null,
  dateOverrides?: Map<string, number> | null,
): number {
  // Tier 1: specific date override
  if (dateOverrides?.has(dateStr)) {
    return dateOverrides.get(dateStr)!;
  }

  // Tier 2: day-of-week pattern
  if (weeklyBudgets?.enabled) {
    const dayOfWeek = parseISO(dateStr).getDay();
    const dayBudgets = [
      weeklyBudgets.sunday,
      weeklyBudgets.monday,
      weeklyBudgets.tuesday,
      weeklyBudgets.wednesday,
      weeklyBudgets.thursday,
      weeklyBudgets.friday,
      weeklyBudgets.saturday,
    ];
    const dayBudget = dayBudgets[dayOfWeek];
    if (dayBudget !== null && dayBudget !== undefined) {
      return dayBudget;
    }
  }

  // Tier 3: global default
  return globalBudget;
}
```

**Step 2: Update SchedulerInput to accept budget overrides**

Update the `SchedulerInput` interface:

```ts
interface SchedulerInput {
  task: { estimated_minutes: number; due_date: string | null; priority: "low" | "medium" | "high"; available_from?: string | null };
  existingTasks: Task[];
  calendarEvents: CalendarEvent[];
  workingHoursStart: string;
  workingHoursEnd: string;
  dailyBudget: number;
  skipWeekends?: boolean;
  weeklyBudgets?: {
    enabled: boolean;
    monday: number | null;
    tuesday: number | null;
    wednesday: number | null;
    thursday: number | null;
    friday: number | null;
    saturday: number | null;
    sunday: number | null;
  } | null;
  dateOverrides?: Map<string, number> | null;
}
```

**Step 3: Update scoreDays to use getEffectiveBudget**

In `scoreDays()`, replace the line `const withinBudget = taskMinutesAfter <= dailyBudget;` (line 128) with:

```ts
const effectiveBudget = getEffectiveBudget(dateStr, dailyBudget, input.weeklyBudgets, input.dateOverrides);
const withinBudget = taskMinutesAfter <= effectiveBudget;
```

And update the `remainingBudget` and `loadRatio` references to use `effectiveBudget` instead of `dailyBudget`:

```ts
const remainingBudget = effectiveBudget - taskMinutesAfter;
budgetScore = 100 + (remainingBudget / Math.max(effectiveBudget, 1)) * 50;
```

```ts
const loadRatio = taskMinutes / Math.max(effectiveBudget, 1);
```

**Step 4: Update rebalanceAutoAssigned input type**

Add `weeklyBudgets` and `dateOverrides` to the rebalance input type and pass them through to `pickBestDay`.

**Step 5: Commit**

```bash
git add src/lib/scheduler.ts
git commit -m "feat: add getEffectiveBudget with three-tier budget precedence"
```

---

### Task 10: Update SettingsPanel with weekly budget UI

**Files:**
- Modify: `src/components/schedule/settings-panel.tsx`

**Step 1: Add new props**

Add to `SettingsPanelProps`:
```ts
customWeeklyBudgetsEnabled: boolean;
budgetMonday: number | null;
budgetTuesday: number | null;
budgetWednesday: number | null;
budgetThursday: number | null;
budgetFriday: number | null;
budgetSaturday: number | null;
budgetSunday: number | null;
```

**Step 2: Add toggle and day inputs**

After the daily budget section (around line 143), add:

```tsx
{/* Custom weekly budgets toggle */}
<div className="flex items-center justify-between">
  <div>
    <Label htmlFor="weekly-budgets">Custom weekly budgets</Label>
    <p className="text-xs text-muted-foreground">
      Set different task budgets for each day of the week
    </p>
  </div>
  <Switch
    id="weekly-budgets"
    checked={customWeeklyBudgetsEnabled}
    onCheckedChange={handleWeeklyBudgetsToggle}
  />
</div>

{/* Per-day budget inputs */}
{customWeeklyBudgetsEnabled && (
  <div className="grid gap-3 sm:grid-cols-2">
    {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map((day) => (
      <div key={day} className="flex items-center gap-2">
        <Label className="w-12 text-xs capitalize shrink-0">{day.slice(0, 3)}</Label>
        <Input
          type="number"
          min={30}
          max={480}
          step={15}
          placeholder={String(dailyBudget)}
          value={localWeeklyBudgets[day] ?? ""}
          onChange={(e) => setLocalWeeklyBudgets((prev) => ({ ...prev, [day]: e.target.value }))}
          onBlur={() => commitWeeklyBudget(day)}
          className="h-9"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">min</span>
      </div>
    ))}
  </div>
)}
```

**Step 3: Add local state and handlers**

Add state for the 7 day inputs and handlers to save on blur (same pattern as `commitBudget`).

**Step 4: Commit**

```bash
git add src/components/schedule/settings-panel.tsx
git commit -m "feat: add weekly budget toggle and per-day inputs to settings panel"
```

---

### Task 11: Add per-date budget override UI to schedule page

**Files:**
- Modify: `src/components/schedule/day-timeline.tsx`
- Modify: `src/app/(app)/schedule/page.tsx`

**Step 1: Add budget display to "Tasks on this day" card**

In the `DayTimeline` component, add new props:
```ts
effectiveBudget?: number;
dateOverride?: number | null;
onBudgetOverride?: (minutes: number) => void;
onClearBudgetOverride?: () => void;
```

At the top of the "Tasks on this day" card (inside CardHeader, after the CardTitle), add an inline budget editor:

```tsx
<div className="flex items-center gap-2 mt-1">
  <span className="text-xs text-muted-foreground">Budget:</span>
  <Input
    type="number"
    min={30}
    max={480}
    step={15}
    value={localBudgetOverride}
    onChange={(e) => setLocalBudgetOverride(e.target.value)}
    onBlur={commitBudgetOverride}
    className="h-7 w-20 text-xs"
  />
  <span className="text-xs text-muted-foreground">min</span>
  {dateOverride !== null && dateOverride !== undefined && onClearBudgetOverride && (
    <button
      onClick={onClearBudgetOverride}
      className="text-xs text-muted-foreground hover:text-foreground underline"
    >
      reset
    </button>
  )}
</div>
```

**Step 2: Wire up in schedule page**

In `schedule/page.tsx`:
- Fetch the budget override for `selectedDate` using `api.getDailyBudgetOverride(selectedDate)`
- Compute `effectiveBudget` using `getEffectiveBudget()`
- Pass props to `DayTimeline`
- Handle upsert/delete callbacks

**Step 3: Commit**

```bash
git add src/components/schedule/day-timeline.tsx src/app/\(app\)/schedule/page.tsx
git commit -m "feat: add per-date budget override UI to schedule page"
```

---

### Task 12: Wire budget overrides through all scheduler call sites

**Files:**
- Modify: `src/app/(app)/schedule/page.tsx`
- Modify: `src/app/(app)/tasks/page.tsx`

**Step 1: Update schedule page scheduler calls**

Update `handleAutoAssignAll` and `handleRebalance` to pass `weeklyBudgets` and `dateOverrides` to `pickBestDayWithInfo` and `rebalanceAutoAssigned`.

Fetch overrides for the 14-day window using `api.getDailyBudgetOverridesRange()` and convert to a `Map<string, number>`.

Build the `weeklyBudgets` object from `settings`.

**Step 2: Update tasks page scheduler calls**

Update `handleCreateTask` in tasks page to pass `weeklyBudgets` and `dateOverrides` to `rebalanceAutoAssigned`.

**Step 3: Commit**

```bash
git add src/app/\(app\)/schedule/page.tsx src/app/\(app\)/tasks/page.tsx
git commit -m "feat: wire budget overrides through all scheduler call sites"
```

---

### Task 13: Pass new settings props to SettingsPanel

**Files:**
- Modify: `src/app/(app)/schedule/page.tsx` (if SettingsPanel is used there)

Note: Looking at the schedule page, the SettingsPanel is NOT rendered there — it's on the `/settings` page. Check where SettingsPanel is actually used and add the new props.

**Step 1: Find SettingsPanel usage**

Search for SettingsPanel imports and add the new weekly budget props wherever it's used.

**Step 2: Commit**

```bash
git commit -m "feat: pass weekly budget props to SettingsPanel"
```

---

### Task 14: Build, test, and deploy

**Step 1: Run frontend build**

```bash
cd ~/Downloads/Projects/DoIt && npm run build
```

Fix any TypeScript errors.

**Step 2: Test backend**

```bash
cd ~/Downloads/Projects/DoIt/backend && python -c "from app.main import app; print('Backend OK')"
```

**Step 3: Deploy to homelab**

```bash
cd ~/Downloads/Projects/homelab && docker compose up -d --build doit-backend doit
```

**Step 4: Final commit and push**

```bash
cd ~/Downloads/Projects/DoIt && git push
```
