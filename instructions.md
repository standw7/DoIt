Executive summary

You’re building a calm, single-user “daily list + project backlog” system that can (a) turn projects into actionable tasks, (b) pull tasks into a dated daily list, and (c) schedule that day’s tasks into Google Calendar based on your available time budget and actual free/busy windows.

Key design choice: the ChatGPT/Gemini integration will be “subscription-friendly” by using copy/paste import/export (structured JSON) rather than calling OpenAI/Gemini APIs. The app will provide a strict, machine-readable protocol so an LLM can reliably generate tasks that your app can validate and ingest.

⸻

PLD (product + lightweight technical design): Daily list + projects + calendar scheduling + LLM-assisted planning (no LLM API)

1) Product goals

Primary goals
	1.	Fast capture and organization: projects → tasks → daily list (by date).
	2.	Low-overwhelm daily execution: a single daily list view per date.
	3.	Real scheduling: turn daily tasks into calendar blocks in free time.
	4.	LLM-assisted decomposition and estimation without paying LLM API fees.

Non-goals (v1)
	•	Multi-user collaboration, shared projects, team assignment.
	•	Full GTD/PKM system (notes/wiki), email ingest, complex dependencies.
	•	Native mobile apps (PWA responsive is sufficient).
	•	Automated LLM calls from the app.

Success metrics (v1)
	•	Time-to-add-a-task < 10 seconds.
	•	Time-to-build-a-daily-list < 60 seconds for a typical day.
	•	Calendar schedule success rate: ≥ 90% of days schedule without manual conflict repair.
	•	“Overwhelm” reduction: user-reported clarity score improves after 2 weeks.

⸻

2) Core objects and concepts

Entities
	•	Project: a container with progress tracking.
	•	Task: atomic unit of work, optionally tied to a project.
	•	Daily list: a dated view (YYYY-MM-DD) of tasks you intend to do that day.
	•	Calendar block: an event created in Google Calendar representing scheduled work on a task.

Task fields (required by your spec)
	•	Name
	•	Project (nullable)
	•	Day (nullable; when assigned to a daily list date)
	•	Estimated time (minutes; can be manual or LLM-estimated via import)
	•	Description (clear “what to do”)

Additional fields recommended (high leverage, minimal complexity)
	•	Status: backlog | planned | scheduled | done | skipped
	•	Priority: low | medium | high
	•	Due date (separate from “day”; due date can drive suggestions)
	•	Split-allowed boolean (whether scheduler can break it into chunks)
	•	Tags (optional)

⸻

3) UX structure (simple, non-cluttered)

Global navigation (3 primary screens)
	1.	Today / Daily (default)
	•	Shows one day’s list with a date selector (today + future dates).
	•	If list doesn’t exist: prominent “Create list for this date” action.
	•	Sections: “Planned” tasks, “Scheduled” tasks (with times), “Done”.
	2.	Projects
	•	List of projects with progress bars.
	•	Clicking a project shows its tasks (backlog + planned + done).
	•	Add task inline under project.
	3.	Schedule
	•	“Time budget” selector for the day (e.g., 60/90/120 minutes).
	•	Pulls Google Calendar free/busy and shows available slots.
	•	Button: “Schedule my day” + an editable proposed plan before writing to calendar.

Key UI principles
	•	Default to one decision at a time.
	•	Hide complexity behind “advanced” accordions.
	•	Use a single primary action per screen.
	•	Avoid dense tables; favor short cards and progressive disclosure.

⸻

4) Functional requirements

4.1 Daily list (dated)

Requirements
	•	A daily list exists per date (YYYY-MM-DD).
	•	User can create daily lists for future dates.
	•	If no list exists for selected date: show empty state with “Create list”.

Behaviors
	•	Adding a task to a date sets task.day = that_date and status = planned.
	•	Daily list can also show “suggested tasks” (based on due date, priority) without forcing them into the list.

Acceptance criteria
	•	Selecting a date never shows another date’s tasks.
	•	Creating a future daily list doesn’t auto-populate unless user opts in.

⸻

4.2 Projects page + project tasks

Requirements
	•	Projects page lists projects and allows creation.
	•	Each project page supports adding tasks underneath it.
	•	Tasks can later be added to daily lists.

Progress bar logic
	•	Default: percent of tasks done.
	•	Better: weighted by estimated minutes:
progress = done_minutes / total_minutes (fallback to count if estimates missing).

Acceptance criteria
	•	Progress updates immediately when tasks are marked done.
	•	Completing a task on a daily list updates the project progress.

⸻

4.3 Adding project tasks to daily lists (due-date-driven + manual)

Two mechanisms:
	1.	Manual add: “Add to date…” from task card.
	2.	Due date suggestion: tasks with due dates show in “Suggested for this day” when due soon.

Rules
	•	day is the commitment date (daily list membership).
	•	due_date is the deadline driver (suggestions + warnings).
	•	A task may be planned for a day earlier than its due date.

⸻

4.4 Google Calendar integration (free time + scheduling)

Requirements
	•	OAuth sign-in to Google to read free/busy and create events.
Google Calendar API overview: https://developers.google.com/calendar/api/guides/overview
Free/busy guide: https://developers.google.com/calendar/api/v3/reference/freebusy/query

Capabilities
	•	Fetch free/busy for selected day and chosen calendars.
	•	Display free slots within user-defined working hours (defaults: 9–5).
	•	Create calendar events that:
	•	include task name
	•	include a stable task ID in description for later reconciliation
	•	optionally include a link back to the task in the app

Scheduling constraints
	•	Respect existing events.
	•	Respect daily time budget (e.g., “I want to do 90 minutes of tasks today”).
	•	Prefer longer contiguous blocks; otherwise split tasks if allowed.

Acceptance criteria
	•	“Preview schedule” shown before writing.
	•	“Write schedule” creates events without duplicating if run twice (idempotency via stored event IDs).

⸻

4.5 Time-per-day budget + task time estimation

Requirements
	•	User sets a daily minutes target.
	•	Scheduler uses either:
	•	manual estimated minutes, or
	•	imported LLM-estimated minutes (since no API calls).

Behavior
	•	If total planned minutes > budget: show warning + offer “choose subset” (by priority / due date).
	•	If total planned minutes < budget: suggest additional backlog tasks.

⸻

4.6 ChatGPT/Gemini integration without API (subscription-friendly)

Hard constraint
	•	No direct OpenAI/Gemini API calls from your app.

Solution pattern
	•	Provide an Import/Export page with:
	•	“Export project context” (JSON) for the user to paste into ChatGPT/Gemini.
	•	“Import tasks” (JSON) that the LLM generates and the user pastes back.
	•	Strict schema validation with human-readable errors.

User flows
	1.	User exports a project brief + existing tasks.
	2.	User pastes into ChatGPT/Gemini (subscription UI), asks it to generate a task breakdown that obeys the protocol.
	3.	User pastes the JSON output into your app; app validates + imports.

Why this works
	•	Uses ChatGPT Plus / Gemini Advanced as the “thinking surface” with zero app-side LLM cost.
	•	Reliability comes from schema + deterministic validation.

⸻

5) The LLM task-creation protocol (machine-readable, strict)

5.1 Output format
	•	JSON only (no prose).
	•	Must match schema version.
	•	Deterministic fields and constraints to keep imports consistent.

5.2 JSON schema (v1)

Your dev team should implement exact validation. Below is the canonical shape.

{
  "schema_version": "todo_pld.v1",
  "project": {
    "project_id": "optional-if-known",
    "project_name": "string",
    "project_goal": "string",
    "project_definition_of_done": "string"
  },
  "tasks": [
    {
      "client_task_id": "string-unique-within-payload",
      "name": "string",
      "project_name": "string",
      "day": "YYYY-MM-DD or null",
      "estimated_minutes": 15,
      "description": "string",
      "priority": "low|medium|high",
      "due_date": "YYYY-MM-DD or null",
      "split_allowed": true
    }
  ],
  "assumptions": ["string"],
  "questions_for_user": ["string"]
}

5.3 Validation rules (must enforce)
	•	schema_version must equal todo_pld.v1.
	•	tasks[].estimated_minutes integer, 5–480.
	•	tasks[].name <= 80 chars; imperative verb preferred.
	•	tasks[].description must contain concrete steps (no vague “work on X”).
	•	tasks[].day if present must be a valid date and not in the past unless explicitly allowed.
	•	client_task_id unique within payload.
	•	No markdown, no trailing commentary.

5.4 Style rules the LLM must follow (embed these in your export prompt)
	•	Break work into tasks sized 15–60 minutes.
	•	If something is uncertain, create a short “Clarify…” task rather than guessing.
	•	Prefer observable outputs (“Draft outline”, “Create checklist”, “Call vendor”) over abstractions.
	•	Include dependencies implicitly by ordering; avoid explicit dependency graphs in v1.

5.5 App-provided “prompt boilerplate” (user copy/paste into ChatGPT/Gemini)

The app should display this verbatim (with the project context filled in), so the user can paste into ChatGPT/Gemini:
	•	System-style instruction (first line):
“Return only valid JSON that matches the schema. No prose.”
	•	Then include:
	•	Project goal
	•	Definition of done
	•	Constraints (time budget, deadlines)
	•	Existing tasks (so it doesn’t duplicate)
	•	The schema + validation rules summary

This is what makes the “no API integration” route actually dependable.

⸻

6) Scheduling algorithm (v1, pragmatic)

Inputs
	•	Planned tasks for day (or candidate tasks)
	•	Each task minutes, priority, due date
	•	User working hours window (e.g., 09:00–17:00)
	•	Calendar free/busy intervals
	•	Daily time budget

Output
	•	Ordered list of “task blocks” with start/end times
	•	Optionally split tasks into chunks (e.g., 45 min becomes 30+15)

Heuristic (good enough for v1)
	1.	Filter to tasks in the daily list and not done.
	2.	Sort by:
	•	due date ascending (null last)
	•	priority high→low
	•	shorter tasks first (to pack gaps)
	3.	Compute free slots from calendar.
	4.	Greedy pack tasks into slots until reaching budget:
	•	Prefer slot ≥ task size
	•	If none, split if allowed
	5.	Present plan preview; allow user to drag/drop reorder before committing.

Edge cases
	•	Too little free time: propose unscheduled list and show exactly how many minutes could not be scheduled.
	•	All-day events / travel: reduce working window.
	•	Time zones: treat all dates and times in user’s local tz consistently.

⸻

7) Lightweight technical design (v1)

Architecture
	•	Frontend: React + TypeScript (or Next.js) + minimalist component library.
	•	Backend: Node.js (NestJS/Express) or Python (FastAPI).
	•	Database: Postgres.
	•	Auth: email magic link or OAuth (Google sign-in is already needed if you want).
	•	Calendar integration:
	•	OAuth 2.0
	•	Store refresh token encrypted at rest
	•	Use Google Calendar API freebusy + events.insert/update

Key endpoints (internal; not “LLM API”)
	•	POST /projects
	•	GET /projects
	•	POST /projects/{id}/tasks
	•	PATCH /tasks/{id}
	•	POST /daily-lists/{date}/tasks (assign)
	•	POST /calendar/schedule/{date} (creates preview)
	•	POST /calendar/commit/{date} (writes events)
	•	POST /imports/tasks (validates schema and imports)

Security/privacy
	•	Encrypt tokens at rest (KMS if on cloud).
	•	Principle of least privilege scopes for Google Calendar:
	•	If possible, use per-calendar selection and minimal scopes; otherwise document why broader is required.
	•	Audit log of calendar writes (for undo).

Undo/repair
	•	Store google_event_id on each scheduled block.
	•	“Unschedule day” deletes events created by the app (identified by stored IDs).

⸻

8) Milestones (what to build first)
	1.	MVP core
	•	Projects, tasks, daily lists, done/undone
	•	Progress bars
	2.	Calendar read-only
	•	OAuth + free/busy view
	3.	Scheduling preview
	•	Generate plan without writing events
	4.	Calendar write
	•	Commit events + idempotency + undo
	5.	LLM import/export
	•	Export prompt payload
	•	Import JSON + validation UX

⸻

9) Adjacent question you didn’t ask but should decide now

Do you want this to be strictly “one human, one account,” or eventually multi-user/collaborative? The data model choices (ownership, sharing, permissions) are easiest to set early, even if v1 ships single-user.

- This project should be intended for one human and one account. Notably, this should be able to be accessed from an array of devices (phones, ipad, laptop, desktop, etc) for easy task syncing. this should also be web-app friendly for using on an iphone. 

If you want, I can also produce:
	•	A Figma-level wireframe description (screen-by-screen).
	•	A stricter JSON Schema (draft-07) your team can drop into validation.
	•	A test plan with concrete acceptance tests for scheduling and import validation.