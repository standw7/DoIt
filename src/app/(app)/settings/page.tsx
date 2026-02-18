"use client";

import { useSettings } from "@/hooks/use-settings";
import { useRecurringTasks } from "@/hooks/use-recurring-tasks";
import { SettingsPanel } from "@/components/schedule/settings-panel";
import { RecurringTasksSection } from "@/components/settings/recurring-tasks-section";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const {
    settings,
    loading: settingsLoading,
    calendarConnected,
    updateSettings,
    setupCalendar,
  } = useSettings();

  const {
    recurringTasks,
    loading: recurringLoading,
    createRecurringTask,
    updateRecurringTask,
    deleteRecurringTask,
  } = useRecurringTasks();

  const loading = settingsLoading || recurringLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-24">
      <h1 className="text-xl font-semibold">Settings</h1>

      <SettingsPanel
        workingHoursStart={settings.working_hours_start}
        workingHoursEnd={settings.working_hours_end}
        dailyBudget={settings.daily_minutes_budget}
        autoAssignEnabled={settings.auto_assign_enabled}
        calendarConnected={calendarConnected}
        onUpdate={updateSettings}
        onSetupCalendar={setupCalendar}
      />

      <RecurringTasksSection
        recurringTasks={recurringTasks}
        onCreate={createRecurringTask}
        onUpdate={updateRecurringTask}
        onDelete={deleteRecurringTask}
      />
    </div>
  );
}
