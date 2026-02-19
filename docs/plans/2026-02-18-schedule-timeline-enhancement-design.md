# Schedule Timeline Enhancement Design

**Date:** 2026-02-18

## Goal

Enhance the existing DayTimeline to auto-stack DoIt tasks into the timeline as blocks in free gaps between Google Calendar events, creating a unified visual schedule. Add a "work done" state after working hours.

## Current Behavior

- Google Calendar events render as blue blocks on the timeline
- Unscheduled tasks (planned, no google_event_id) render in a separate "Planned Tasks" card below the timeline

## Enhanced Behavior

1. **Unified timeline** — Tasks auto-stack into free time gaps between calendar events as green blocks
2. **Auto-stacking algorithm**: Sort events by start time, find free gaps within working hours, place tasks sequentially in gaps (earliest available slot first)
3. **"Work done" state** — For today only, after working_hours_end + 30 min, show a "You're done for the day" message at the bottom of the timeline
4. **No separate card** — Remove the "Planned Tasks" card since tasks now appear on the timeline

## Props Change

- Add `isToday: boolean` prop to DayTimeline for the work-done state

## Visual Distinction

- Calendar events: blue (existing)
- DoIt tasks: green (existing color scheme, already defined)
- Work done banner: muted background with check icon
