# Task Editing + Optimistic Updates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recurring task editing, an edit button on task cards, and optimistic updates for all task mutations.

**Architecture:** Extend `RecurringTaskDialog` with an edit mode via optional `editingTask` prop. Add a pencil icon to `TaskCard`. Convert `use-tasks.ts` and `use-recurring-tasks.ts` from fetch-after-mutate to optimistic local state updates with server sync and rollback on error.

**Tech Stack:** Next.js 16, React, Supabase, TypeScript, shadcn/ui, Sonner toasts

---

### Task 1: Add edit mode to RecurringTaskDialog

**Files:**
- Modify: `src/components/settings/recurring-task-dialog.tsx`

**Step 1: Update the component to accept an optional editingTask prop**

Change the props interface and component to support both create and edit modes:

```tsx
interface RecurringTaskDialogProps {
  onCreate?: (task: RecurringTaskInsert) => Promise<void>;
  onUpdate?: (id: string, updates: RecurringTaskUpdate) => Promise<void>;
  editingTask?: RecurringTask | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
```

When `editingTask` is provided:
- Pre-fill all form fields from `editingTask` values in a `useEffect`
- Dialog title becomes "Edit Recurring Task"
- Submit button text becomes "Save Changes"
- Submit calls `onUpdate(editingTask.id, updates)` instead of `onCreate`
- Remove `DialogTrigger` (parent controls open state)

When `editingTask` is not provided:
- Keep existing create behavior with internal `open` state and `DialogTrigger`

**Step 2: Verify it still works for creation**

Run: `npm run dev`, navigate to Tasks page, click "Add recurring task", create one. Should work as before.

**Step 3: Commit**

```bash
git add src/components/settings/recurring-task-dialog.tsx
git commit -m "feat: add edit mode to RecurringTaskDialog"
```

---

### Task 2: Wire up recurring task editing in RecurringTasksSection

**Files:**
- Modify: `src/components/settings/recurring-tasks-section.tsx`

**Step 1: Add edit state and click handler**

Add state for the task being edited. Make the recurring task row's text area clickable to open the edit dialog:

```tsx
const [editingTask, setEditingTask] = useState<RecurringTask | null>(null);
```

Add `cursor-pointer` and `onClick={() => setEditingTask(task)}` to the row's `<div className="flex-1 min-w-0">`.

Add a second `RecurringTaskDialog` instance at the bottom of the component for editing:

```tsx
<RecurringTaskDialog
  editingTask={editingTask}
  open={!!editingTask}
  onOpenChange={(v) => { if (!v) setEditingTask(null); }}
  onUpdate={onUpdate}
/>
```

**Step 2: Test in browser**

Navigate to Tasks page. Click on a recurring task's name/day. The edit dialog should open pre-filled. Change a field, save. Verify it updates.

**Step 3: Commit**

```bash
git add src/components/settings/recurring-tasks-section.tsx
git commit -m "feat: wire up recurring task editing in section"
```

---

### Task 3: Add edit button to TaskCard

**Files:**
- Modify: `src/components/tasks/task-card.tsx`

**Step 1: Add a pencil icon button**

Import `Pencil` from lucide-react. Add a button between the task content area and the dropdown menu:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 shrink-0"
  onClick={() => setDetailOpen(true)}
>
  <Pencil className="h-4 w-4" />
</Button>
```

**Step 2: Test in browser**

Navigate to Today or Tasks page. Each task card should now show a pencil icon. Clicking it opens the edit dialog. Clicking the task text should also still open the dialog.

**Step 3: Commit**

```bash
git add src/components/tasks/task-card.tsx
git commit -m "feat: add edit button to task cards"
```

---

### Task 4: Optimistic updates in use-tasks.ts

**Files:**
- Modify: `src/hooks/use-tasks.ts`

**Step 1: Rewrite updateTask with optimistic update**

```typescript
async function updateTask(id: string, updates: TaskUpdate) {
  const prev = tasks;
  setTasks((t) => t.map((task) => task.id === id ? { ...task, ...updates } : task));
  try {
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) throw error;
  } catch {
    setTasks(prev);
    toast.error("Failed to update task");
  }
}
```

**Step 2: Rewrite deleteTask with optimistic update**

```typescript
async function deleteTask(id: string) {
  const prev = tasks;
  setTasks((t) => t.filter((task) => task.id !== id));
  try {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
  } catch {
    setTasks(prev);
    toast.error("Failed to delete task");
  }
}
```

**Step 3: Rewrite toggleDone to use the optimistic updateTask**

`toggleDone` already calls `updateTask`, so it inherits the optimistic behavior automatically. No changes needed.

**Step 4: Remove `await fetchTasks()` from updateTask and deleteTask**

The real-time subscription already calls `fetchTasks()` on any server change, so the explicit refetch after mutation is redundant. Remove the `await fetchTasks()` lines from `updateTask` and `deleteTask`. Keep it in `createTask` since the server generates the real ID.

**Step 5: Add toast import**

```typescript
import { toast } from "sonner";
```

**Step 6: Test in browser**

- Toggle a task done — should update instantly with no flicker.
- Edit a task name — should reflect immediately.
- Delete a task — should disappear instantly.
- Disconnect network and try an action — should revert with error toast.

**Step 7: Commit**

```bash
git add src/hooks/use-tasks.ts
git commit -m "feat: optimistic updates for task mutations"
```

---

### Task 5: Optimistic updates in use-recurring-tasks.ts

**Files:**
- Modify: `src/hooks/use-recurring-tasks.ts`

**Step 1: Rewrite updateRecurringTask with optimistic update**

Same pattern as use-tasks.ts:

```typescript
async function updateRecurringTask(id: string, updates: RecurringTaskUpdate) {
  const prev = recurringTasks;
  setRecurringTasks((t) => t.map((task) => task.id === id ? { ...task, ...updates } : task));
  try {
    const { error } = await supabase.from("recurring_tasks").update(updates).eq("id", id);
    if (error) throw error;
  } catch {
    setRecurringTasks(prev);
    toast.error("Failed to update recurring task");
  }
}
```

**Step 2: Rewrite deleteRecurringTask with optimistic update**

```typescript
async function deleteRecurringTask(id: string) {
  const prev = recurringTasks;
  setRecurringTasks((t) => t.filter((task) => task.id !== id));
  try {
    const { error } = await supabase.from("recurring_tasks").delete().eq("id", id);
    if (error) throw error;
  } catch {
    setRecurringTasks(prev);
    toast.error("Failed to delete recurring task");
  }
}
```

**Step 3: Remove `await fetchRecurringTasks()` from update and delete**

**Step 4: Add toast import**

```typescript
import { toast } from "sonner";
```

**Step 5: Test in browser**

- Toggle a recurring task active/inactive — should update instantly.
- Edit a recurring task — should reflect immediately.
- Delete a recurring task — should disappear instantly.

**Step 6: Commit**

```bash
git add src/hooks/use-recurring-tasks.ts
git commit -m "feat: optimistic updates for recurring task mutations"
```

---

### Task 6: Remove duplicate toast in TaskDetailDialog

**Files:**
- Modify: `src/components/tasks/task-detail-dialog.tsx`

**Step 1: Remove try/catch in handleSave**

Since `updateTask` now handles its own error toasting via optimistic rollback, the dialog's try/catch is redundant and shows double toasts on error. Simplify to:

```typescript
function handleSave() {
  onUpdate(task.id, {
    name: name.trim(),
    description: description.trim() || null,
    priority,
    estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
    due_date: dueDate || null,
    day: day || null,
    status: day && task.status === "backlog" ? "planned" : task.status,
  });
  onOpenChange(false);
}
```

Also remove the `toast.success("Task updated")` since the optimistic update makes the change visible immediately — no confirmation needed.

**Step 2: Commit**

```bash
git add src/components/tasks/task-detail-dialog.tsx
git commit -m "fix: remove duplicate toast from task detail dialog"
```

---

### Task 7: Final verification and push

**Step 1: Run build to check for type errors**

```bash
npm run build
```

Fix any TypeScript errors.

**Step 2: Test full flow in browser**

1. Create a one-time task — verify it appears.
2. Click the pencil icon — verify edit dialog opens.
3. Edit the task name and save — verify instant update.
4. Toggle task done — verify instant checkbox change.
5. Delete a task — verify instant removal.
6. Create a recurring task — verify it appears.
7. Click on a recurring task — verify edit dialog opens pre-filled.
8. Change recurrence day and save — verify instant update.
9. Delete a recurring task — verify instant removal.

**Step 3: Push**

```bash
git push
```
