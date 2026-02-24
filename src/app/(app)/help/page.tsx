"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CircleHelp } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <h1 className="flex items-center gap-2 font-semibold text-lg">
        <CircleHelp className="h-5 w-5" />
        Help &amp; Documentation
      </h1>

      <p className="text-muted-foreground text-sm">
        Everything you need to know about using DoIt.
      </p>

      <Accordion
        type="multiple"
        defaultValue={[
          "getting-started",
          "today-view",
          "tasks-backlog",
          "projects",
          "recurring-tasks",
          "schedule-calendar",
          "scheduling-algorithm",
          "settings",
        ]}
      >
        <AccordionItem value="getting-started">
          <AccordionTrigger>Getting Started</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm">
              DoIt is your calm daily task manager. Sign up with your email to get
              started. Use the sidebar (desktop) or bottom nav (mobile) to
              navigate between Today, Tasks, Projects, Schedule, Settings, and Help.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="today-view">
          <AccordionTrigger>Today View</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>
                Your daily task list shows tasks assigned to today. Mark tasks done
                with the checkbox or skip them. Click the pencil icon on
                a task card to edit its details.
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Tasks scheduled to Google Calendar show their time slot.</li>
                <li>The suggestions area shows unassigned backlog tasks you can pull into today.</li>
                <li>Completed tasks collapse into a &ldquo;Done&rdquo; section at the bottom.</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tasks-backlog">
          <AccordionTrigger>Tasks &amp; Backlog</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>
                View all your tasks organized by status. Create new tasks with the
                + button. Each task can have:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Name</strong> and optional <strong>description</strong>.</li>
                <li><strong>Priority</strong> (low, medium, high) &mdash; high-priority tasks are scheduled earlier.</li>
                <li><strong>Time estimate</strong> in minutes &mdash; choose from presets (15m, 30m, 45m, 1h, 2h) or enter a custom value.</li>
                <li><strong>Due date</strong> &mdash; the scheduler will place the task before this date.</li>
                <li><strong>Project</strong> &mdash; group tasks under a project for organization.</li>
                <li><strong>Weekend task</strong> toggle &mdash; marks the task to preferentially be scheduled on Saturday or Sunday, even if &ldquo;Skip weekends&rdquo; is on.</li>
                <li><strong>Schedule for day</strong> &mdash; manually assign to a specific day, or leave blank for auto-assignment.</li>
              </ul>
              <p>
                Tasks without a day assigned live in your backlog until you assign
                or auto-assign them. One-time tasks are sorted by their assigned day.
                Use the date range filter chips (2 Days, Week, 2 Weeks, All) to
                narrow what you see.
              </p>
              <p>
                Any change to tasks (creating, editing, or deleting) automatically
                rebalances your schedule to keep assignments optimal.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="projects">
          <AccordionTrigger>Projects</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>
                Group related tasks under projects for better organization. Create
                a project with a name and optional description. The progress bar
                shows how many tasks are completed. Click a project to see its
                tasks, add new ones, or edit existing ones.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="recurring-tasks">
          <AccordionTrigger>Recurring Tasks</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>
                Set up tasks that repeat automatically. In Settings, create
                recurring tasks with:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Repeats every</strong> &mdash; pick which days of the week (Mon&ndash;Sun).</li>
                <li><strong>Time estimate</strong> and <strong>priority</strong>.</li>
                <li><strong>Available days before due</strong> &mdash; how many days before the due date the task becomes eligible for scheduling (e.g., set to 3 so the task can be placed up to 3 days early).</li>
                <li><strong>End date</strong> &mdash; optional date when the recurrence stops.</li>
                <li><strong>Weekend task</strong> toggle &mdash; recurring instances will prefer weekend scheduling.</li>
              </ul>
              <p>
                Task instances are auto-generated for upcoming days. Click a
                recurring task row to edit its details. You can also create
                recurring tasks from the &ldquo;Create Task&rdquo; dialog on the
                Tasks page by toggling &ldquo;Make recurring.&rdquo;
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="schedule-calendar">
          <AccordionTrigger>Schedule &amp; Calendar</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>
                The Schedule page shows a visual timeline of your day with hour
                markers and your calendar events.
              </p>
              <p><strong>Timeline</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Tasks appear as colored blocks &mdash; <strong>emerald green</strong> when
                  scheduled to Google Calendar, <strong>mint green</strong> when not yet
                  scheduled.</li>
                <li>External calendar events appear in their calendar color (or blue).</li>
                <li>A red line shows the current time when viewing today.</li>
                <li><strong>Drag and drop</strong> unscheduled task blocks up/down to reposition them (snaps to 5-minute increments).</li>
                <li>The <strong>Budget</strong> field in the timeline header lets you override the daily task budget for this specific date. Click &ldquo;reset&rdquo; to revert to the default.</li>
              </ul>
              <p><strong>Actions</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Assign tasks</strong> &mdash; auto-assigns unassigned backlog tasks to optimal upcoming days.</li>
                <li><strong>Rebalance schedule</strong> &mdash; re-distributes auto-assigned tasks for even spread across days.</li>
                <li><strong>Schedule my day</strong> &mdash; pushes planned tasks to Google Calendar as events at their positioned times.</li>
              </ul>
              <p><strong>Tasks on this day</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Check off tasks with the checkbox &mdash; they stay visible with a strikethrough so you can see what you&apos;ve accomplished.</li>
                <li>Uncheck to mark a task as planned again.</li>
                <li>Use the pencil icon to edit, the calendar-minus icon to remove from Google Calendar, or the X to unassign from the day.</li>
              </ul>
              <p><strong>Overdue review</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>When tasks are past due, an overdue review panel appears at the top.</li>
                <li>You can reschedule, mark done, or skip each overdue task.</li>
                <li>Rescheduling triggers an automatic rebalance.</li>
              </ul>
              <p><strong>Conflict detection</strong></p>
              <ul className="list-disc pl-4 space-y-1">
                <li>If a scheduled task event overlaps with a new calendar event, DoIt detects the conflict and offers to reschedule.</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="scheduling-algorithm">
          <AccordionTrigger>How Scheduling Works</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>
                DoIt uses a smart scheduling algorithm to pick the best day for each task. It considers:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Daily budget</strong> &mdash; tasks won&apos;t exceed the configured minutes per day (unless due today with no alternatives).</li>
                <li><strong>Even distribution</strong> &mdash; spreads tasks across days to avoid overloading any single day.</li>
                <li><strong>Due date urgency</strong> &mdash; tasks closer to their due date score higher for earlier days.</li>
                <li><strong>Priority</strong> &mdash; high-priority tasks are placed sooner.</li>
                <li><strong>Weekend preference</strong> &mdash; tasks marked as &ldquo;weekend task&rdquo; get a strong bonus for Saturday/Sunday and bypass the skip-weekends setting.</li>
                <li><strong>Available-from date</strong> &mdash; recurring tasks with &ldquo;available days before due&rdquo; won&apos;t be placed before that window opens.</li>
                <li><strong>Per-date and per-day-of-week budgets</strong> &mdash; custom budget overrides are respected.</li>
              </ul>
              <p>
                The schedule <strong>automatically rebalances</strong> whenever you
                create, edit, or delete a task, change the budget, or handle
                overdue tasks. Toggling a task as done does not trigger a rebalance.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="settings">
          <AccordionTrigger>Settings</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>Configure your experience:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Working hours</strong> &mdash; set your start and end times. The timeline and capacity calculations use these.</li>
                <li><strong>Daily task budget</strong> &mdash; how many minutes of task work per day (30&ndash;480 min).</li>
                <li><strong>Custom weekly budgets</strong> &mdash; enable to set different budgets for each day of the week (e.g., lighter Fridays, heavier Tuesdays).</li>
                <li><strong>Skip weekends</strong> &mdash; prevents tasks from being scheduled on Saturday/Sunday (except tasks marked as &ldquo;weekend task&rdquo;).</li>
                <li><strong>Auto-assign</strong> &mdash; toggle automatic task assignment to days.</li>
                <li><strong>Google Calendar</strong> &mdash; connect to see calendar events on your timeline, push tasks as events, and detect conflicts. A dedicated &ldquo;DoIt&rdquo; calendar is created for your task events.</li>
                <li><strong>Recurring tasks</strong> &mdash; create and manage recurring task templates from the settings page.</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="google-calendar">
          <AccordionTrigger>Google Calendar Integration</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 text-sm">
              <p>
                Connect Google Calendar in Settings to unlock calendar features:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>See your calendar events on the schedule timeline alongside tasks.</li>
                <li>Use &ldquo;Schedule my day&rdquo; to push task blocks to Google Calendar at their positioned times.</li>
                <li>Scheduled tasks appear in a dedicated &ldquo;DoIt&rdquo; calendar in Google.</li>
                <li>Remove individual tasks from the calendar with the calendar-minus icon.</li>
                <li>Task-event links are bidirectional &mdash; if the link breaks, DoIt automatically repairs it on reload.</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
