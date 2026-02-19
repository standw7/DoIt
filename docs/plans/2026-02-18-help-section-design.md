# Help Section Design

**Date:** 2026-02-18

## Goal

Add a help/documentation page accessible via a CircleHelp icon in the navigation, providing accordion-style FAQ sections covering all app features.

## Architecture

- Add CircleHelp icon to both sidebar nav and bottom nav, linking to `/help`
- Create `/help` page using shadcn/ui Accordion component
- Static content organized by feature area

## Sections

1. **Getting Started** — What DoIt is, sign in, basic navigation
2. **Today View** — Daily task list, completing/skipping, suggestions
3. **Tasks & Backlog** — Task CRUD, priorities, time estimates, due dates
4. **Projects** — Creating projects, project tasks, progress tracking
5. **Recurring Tasks** — Setting up repeating tasks, editing, frequency options
6. **Daily Digest** — Email digest setup, weather, city settings
7. **Schedule & Calendar** — Timeline view, Google Calendar integration, auto-assign, scheduling
8. **Settings** — Working hours, daily budget, calendar connection, digest

## UI

- Sidebar: CircleHelp icon between Settings and Sign out
- Bottom nav: CircleHelp icon as 6th item
- Page: centered max-w-3xl, heading + accordion with all sections expanded by default
