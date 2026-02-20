"use client";

import { useEffect, useState, useCallback } from "react";
import * as api from "@/lib/api";
import { UserSettings, UserSettingsUpdate } from "@/lib/types";

const DEFAULT_SETTINGS = {
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  daily_minutes_budget: 120,
  auto_assign_enabled: true,
  doit_calendar_id: null as string | null,
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch {
      // Settings may not exist yet — that's fine
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function updateSettings(updates: UserSettingsUpdate) {
    const data = await api.updateSettings(updates);
    setSettings(data);
  }

  async function setupCalendar() {
    // Start Google OAuth flow — redirect to Google
    const { url } = await api.getGoogleAuthUrl();
    window.location.href = url;
    return ""; // won't reach here — page redirects
  }

  async function handleGoogleCallback(code: string) {
    // Exchange code for tokens, then set up the DoIt calendar
    await api.exchangeGoogleCode(code);
    const { calendarId } = await api.setupCalendar();
    await fetchSettings();
    return calendarId;
  }

  const calendarConnected = !!settings?.doit_calendar_id;

  const effectiveSettings = {
    working_hours_start: settings?.working_hours_start ?? DEFAULT_SETTINGS.working_hours_start,
    working_hours_end: settings?.working_hours_end ?? DEFAULT_SETTINGS.working_hours_end,
    daily_minutes_budget: settings?.daily_minutes_budget ?? DEFAULT_SETTINGS.daily_minutes_budget,
    auto_assign_enabled: settings?.auto_assign_enabled ?? DEFAULT_SETTINGS.auto_assign_enabled,
    doit_calendar_id: settings?.doit_calendar_id ?? null,
  };

  return {
    settings: effectiveSettings,
    loading,
    calendarConnected,
    updateSettings,
    setupCalendar,
    handleGoogleCallback,
  };
}
