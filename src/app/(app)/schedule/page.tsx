"use client";

import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";
import { useTasks } from "@/hooks/use-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { DateSelector } from "@/components/daily/date-selector";
import { SettingsPanel } from "@/components/schedule/settings-panel";
import { DayTimeline } from "@/components/schedule/day-timeline";
import { ScheduleButton } from "@/components/schedule/schedule-button";
import { todayString } from "@/lib/utils";
import { getDayCapacity } from "@/lib/scheduler";
import { formatMinutes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(todayString());

  const {
    settings,
    loading: settingsLoading,
    calendarConnected,
    updateSettings,
    setupCalendar,
  } = useSettings();

  const { tasks, loading: tasksLoading, updateTask } = useTasks({ day: selectedDate });
  const { events, loading: eventsLoading, refetch: refetchEvents } = useCalendarEvents(
    selectedDate,
    selectedDate
  );

  const loading = settingsLoading || tasksLoading || eventsLoading;

  const capacity = getDayCapacity(
    selectedDate,
    tasks,
    events,
    settings.working_hours_start,
    settings.working_hours_end
  );

  async function handleEventCreated(taskId: string, eventId: string) {
    await updateTask(taskId, { google_event_id: eventId });
    await refetchEvents();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      {/* Settings panel */}
      <SettingsPanel
        workingHoursStart={settings.working_hours_start}
        workingHoursEnd={settings.working_hours_end}
        dailyBudget={settings.daily_minutes_budget}
        calendarConnected={calendarConnected}
        onUpdate={updateSettings}
        onSetupCalendar={setupCalendar}
      />

      {/* Date selector + capacity summary */}
      <div className="flex flex-col items-center gap-3">
        <DateSelector date={selectedDate} onChange={setSelectedDate} />
        {!loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">
              {formatMinutes(capacity.freeMinutes)} free
            </Badge>
            <span>of {formatMinutes(capacity.totalMinutes)} working</span>
            {capacity.eventMinutes > 0 && (
              <Badge variant="secondary">
                {formatMinutes(capacity.eventMinutes)} in events
              </Badge>
            )}
            {capacity.taskMinutes > 0 && (
              <Badge variant="secondary">
                {formatMinutes(capacity.taskMinutes)} in tasks
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Day timeline */}
      {!loading && (
        <DayTimeline
          date={selectedDate}
          events={events}
          tasks={tasks}
          workStart={settings.working_hours_start}
          workEnd={settings.working_hours_end}
        />
      )}

      {/* Schedule button */}
      {!loading && calendarConnected && (
        <ScheduleButton
          date={selectedDate}
          tasks={tasks}
          events={events}
          workStart={settings.working_hours_start}
          workEnd={settings.working_hours_end}
          onEventCreated={handleEventCreated}
        />
      )}
    </div>
  );
}
