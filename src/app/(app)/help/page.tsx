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
          "settings",
        ]}
      >
        <AccordionItem value="getting-started">
          <AccordionTrigger>Getting Started</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm">
              DoIt is your calm daily task manager. Sign up with your email to get
              started. Use the sidebar (desktop) or bottom nav (mobile) to
              navigate between Today, Tasks, Projects, Schedule, and Settings.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="today-view">
          <AccordionTrigger>Today View</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm">
              Your daily task list shows tasks assigned to today. Mark tasks done
              with the checkbox or skip them. The suggestions area shows
              unassigned tasks you can pull into today. Click the pencil icon on
              a task card to edit its details (name, description, priority, time
              estimate, due date).
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tasks-backlog">
          <AccordionTrigger>Tasks &amp; Backlog</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm">
              View all your tasks organized by status. Create new tasks with the
              + button. Each task can have a name, description, priority (low,
              medium, high), time estimate in minutes, due date, and project.
              Tasks without a day assigned live in your backlog until you assign
              or auto-assign them to a day.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="projects">
          <AccordionTrigger>Projects</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm">
              Group related tasks under projects for better organization. Create
              a project with a name and optional description. The progress bar
              shows how many tasks are completed. Click a project to see its
              tasks, add new ones, or edit existing ones.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="recurring-tasks">
          <AccordionTrigger>Recurring Tasks</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm">
              Set up tasks that repeat automatically. In Settings, create
              recurring tasks with a name, frequency (daily, weekdays, weekly,
              biweekly, or monthly), and optional time estimate. Task instances
              are auto-generated for upcoming days. Click a recurring task row to
              edit its details.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="schedule-calendar">
          <AccordionTrigger>Schedule &amp; Calendar</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm">
              The Schedule page shows a visual timeline of your day with hour
              markers. Connect Google Calendar in Settings to see your calendar
              events alongside your tasks on the timeline. Use
              &ldquo;Auto-assign&rdquo; to let DoIt intelligently distribute
              unassigned tasks across your upcoming days based on capacity. Use
              &ldquo;Schedule my day&rdquo; to push planned tasks to Google
              Calendar as events.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="settings">
          <AccordionTrigger>Settings</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm">
              Configure your experience: set working hours (start and end times),
              daily task time budget in minutes, connect or disconnect Google
              Calendar, and manage recurring tasks.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
