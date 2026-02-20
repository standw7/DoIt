"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSettings } from "@/hooks/use-settings";
import { SettingsPanel } from "@/components/schedule/settings-panel";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledRef = useRef(false);

  const {
    settings,
    loading,
    calendarConnected,
    updateSettings,
    setupCalendar,
    handleGoogleCallback,
  } = useSettings();

  // Handle Google OAuth callback: ?google=callback&code=...
  useEffect(() => {
    const google = searchParams.get("google");
    const code = searchParams.get("code");

    if (google === "callback" && code && !handledRef.current) {
      handledRef.current = true;

      handleGoogleCallback(code)
        .then(() => {
          toast.success("Google Calendar connected!");
          // Clean up URL params
          router.replace("/settings");
        })
        .catch((err: any) => {
          toast.error(err?.detail || "Failed to connect Google Calendar");
          router.replace("/settings");
        });
    }
  }, [searchParams, handleGoogleCallback, router]);

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
    </div>
  );
}
