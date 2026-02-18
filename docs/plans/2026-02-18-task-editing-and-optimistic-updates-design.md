# Task Editing + Optimistic Updates Design

**Date:** 2026-02-18
**Status:** Approved

## Problem

1. Users can't edit recurring tasks after creation (only toggle/delete).
2. The edit dialog for one-time tasks isn't discoverable — no visible edit affordance on task cards.
3. Every interaction (toggle done, edit, delete) waits for the server round-trip before the UI updates, making the app feel sluggish.

## Solution

### 1. Recurring Task Editing

Add edit capability to recurring tasks by extending the existing `RecurringTaskDialog` to support an editing mode.

- Clicking a recurring task row opens the dialog pre-filled with current values.
- Editable fields: name, recurrence day, estimated time, priority, end date, description.
- Reuse `RecurringTaskDialog` with an optional `editingTask` prop. When provided, the dialog pre-fills fields and calls `onUpdate` instead of `onCreate`.
- The `RecurringTasksSection` passes the click handler to each row.

### 2. Edit Button on Task Cards

Add a pencil/edit icon button on each task card to make editing discoverable.

- Place the edit icon in the task card's action area (near the existing dropdown menu).
- Clicking the icon opens the existing `TaskDetailDialog`.
- No changes to the dialog itself — just a new entry point.

### 3. Optimistic Updates

Replace the current fetch-after-mutate pattern with optimistic local state updates.

**Current flow:**
1. User action → API call → wait for response → refetch all tasks → re-render

**New flow:**
1. User action → update local state immediately → re-render → API call in background → if error, revert local state and show toast

**Applied to `use-tasks.ts`:**
- `updateTask`: Patch the task in local state, then send to Supabase.
- `toggleDone`: Update status locally, then sync.
- `deleteTask`: Remove from local state, then send delete. On failure, restore.
- `createTask`: Add to local state with a temp ID, then replace with real ID on server response.

**Applied to `use-recurring-tasks.ts`:**
- Same pattern for create/update/delete recurring tasks.

**Real-time subscriptions** remain as the final source of truth — they reconcile any drift between local and server state.

## Out of Scope

- Inline editing on task cards (click-to-edit name)
- Skeleton loading screens
- React.memo / memoization optimizations
- Reducing redundant fetches across pages
