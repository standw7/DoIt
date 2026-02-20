"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/lib/auth-context";
import { SettingsPanel } from "@/components/schedule/settings-panel";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledRef = useRef(false);
  const { login } = useAuth();

  const {
    settings,
    loading,
    calendarConnected,
    updateSettings,
    setupCalendar,
    handleGoogleCallback,
  } = useSettings();

  // Handle Google OAuth callback: ?google=callback&code=...&state=<token>
  useEffect(() => {
    const google = searchParams.get("google");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (google === "callback" && code && !handledRef.current) {
      handledRef.current = true;

      // Restore JWT from state param (needed when redirect lands on
      // localhost:3003 but user logged in on tasks.homelab)
      if (state && !localStorage.getItem("doit_token")) {
        login(state);
      }

      handleGoogleCallback(code)
        .then(() => {
          toast.success("Google Calendar connected!");
          router.replace("/settings");
        })
        .catch((err: any) => {
          toast.error(err?.detail || "Failed to connect Google Calendar");
          router.replace("/settings");
        });
    }
  }, [searchParams, handleGoogleCallback, router, login]);

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
        skipWeekends={settings.skip_weekends}
        calendarConnected={calendarConnected}
        onUpdate={updateSettings}
        onSetupCalendar={setupCalendar}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <SettingsPageInner />
    </Suspense>
  );
}
