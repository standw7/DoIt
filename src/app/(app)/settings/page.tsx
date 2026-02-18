"use client";

import { useSettings } from "@/hooks/use-settings";
import { SettingsPanel } from "@/components/schedule/settings-panel";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const {
    settings,
    loading,
    calendarConnected,
    updateSettings,
    setupCalendar,
  } = useSettings();

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
        calendarConnected={calendarConnected}
        onUpdate={updateSettings}
        onSetupCalendar={setupCalendar}
      />
    </div>
  );
}
