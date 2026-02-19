# Schedule Timeline Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-stack DoIt tasks into the timeline as blocks in free gaps between Google Calendar events, and add a "work done" state after hours.

**Architecture:** Modify DayTimeline's useMemo to compute free gaps and place tasks as green blocks. Add isToday prop for work-done state.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, date-fns

---

### Task 1: Auto-stack tasks into timeline gaps

**Files:**
- Modify: `src/components/schedule/day-timeline.tsx`

**Step 1: Update the useMemo block**

Replace the current `useMemo` that computes `{ blocks, unscheduledTasks }` with logic that:

1. Creates event blocks as before (blue, from calendar events)
2. Collects unscheduled tasks (planned, no google_event_id, has estimated_minutes)
3. Sorts event blocks by startMin ascending
4. Computes free gaps within working hours:
   - Start from workStartMin
   - For each event block (sorted), the gap before it is free time
   - After the last event, gap until workEndMin is free
5. Iterates through unscheduled tasks, placing each in the earliest gap that fits:
   - If a task fits in the current gap, assign it a startMin/endMin and add as a green block
   - Advance the gap cursor by the task's duration
   - If a task doesn't fit in the remaining gap, move to the next gap
6. Any tasks that don't fit anywhere remain in an `overflowTasks` array (shown in a small note below the timeline)

Return `{ blocks: [...eventBlocks, ...taskBlocks], overflowTasks }` instead of `{ blocks, unscheduledTasks }`.

**Step 2: Update the timeline rendering**

- Sort `blocks` by `startMin` before rendering so events and tasks interleave correctly within each hour
- Remove the separate "Planned Tasks" card at the bottom
- If `overflowTasks.length > 0`, show a small note: "N tasks don't fit in today's schedule"

**Step 3: Verify build**

Run: `cd /Users/stanleywessman/Downloads/Projects/DoIt && npm run build 2>&1 | tail -20`
Expected: builds successfully

**Step 4: Commit**

```bash
git add src/components/schedule/day-timeline.tsx
git commit -m "feat: auto-stack tasks into timeline alongside calendar events"
```

---

### Task 2: Add "work done" state after hours

**Files:**
- Modify: `src/components/schedule/day-timeline.tsx`
- Modify: `src/app/(app)/schedule/page.tsx`

**Step 1: Add isToday prop to DayTimeline**

Update `DayTimelineProps` interface to include `isToday: boolean`.

**Step 2: Add work-done logic**

At the bottom of the timeline card, after the hour markers, add a conditional:

```typescript
const now = new Date();
const nowMin = now.getHours() * 60 + now.getMinutes();
const workDoneThreshold = workEndMin + 30;
const showWorkDone = isToday && nowMin >= workDoneThreshold;
```

If `showWorkDone` is true, render a banner below the last hour marker:

```tsx
<div className="flex items-center gap-2 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
  <CheckCircle2 className="h-4 w-4" />
  You're done for the day!
</div>
```

Import `CheckCircle2` from lucide-react.

**Step 3: Pass isToday from schedule page**

In `src/app/(app)/schedule/page.tsx`, pass the prop:

```tsx
<DayTimeline
  date={selectedDate}
  events={events}
  tasks={tasks}
  workStart={settings.working_hours_start}
  workEnd={settings.working_hours_end}
  isToday={selectedDate === todayString()}
/>
```

**Step 4: Verify build**

Run: `cd /Users/stanleywessman/Downloads/Projects/DoIt && npm run build 2>&1 | tail -20`
Expected: builds successfully

**Step 5: Commit**

```bash
git add src/components/schedule/day-timeline.tsx src/app/(app)/schedule/page.tsx
git commit -m "feat: add work-done banner after hours on today's timeline"
```
