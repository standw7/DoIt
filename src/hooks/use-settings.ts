"use client";

import { useEffect, useState, useCallback } from "react";
import * as api from "@/lib/api";
import { UserSettings, UserSettingsUpdate } from "@/lib/types";

const DEFAULT_SETTINGS = {
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  daily_minutes_budget: 120,
  auto_assign_enabled: true,
  skip_weekends: false,
  custom_weekly_budgets_enabled: false,
  budget_monday: null as number | null,
  budget_tuesday: null as number | null,
  budget_wednesday: null as number | null,
  budget_thursday: null as number | null,
  budget_friday: null as number | null,
  budget_saturday: null as number | null,
  budget_sunday: null as number | null,
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
    // Encode the JWT token into the OAuth state so the callback on
    // localhost:3003 can restore the session (different origin than tasks.homelab)
    const token = localStorage.getItem("doit_token") ?? "";
    const { url } = await api.getGoogleAuthUrl(token);
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
    skip_weekends: settings?.skip_weekends ?? DEFAULT_SETTINGS.skip_weekends,
    custom_weekly_budgets_enabled: settings?.custom_weekly_budgets_enabled ?? DEFAULT_SETTINGS.custom_weekly_budgets_enabled,
    budget_monday: settings?.budget_monday ?? null,
    budget_tuesday: settings?.budget_tuesday ?? null,
    budget_wednesday: settings?.budget_wednesday ?? null,
    budget_thursday: settings?.budget_thursday ?? null,
    budget_friday: settings?.budget_friday ?? null,
    budget_saturday: settings?.budget_saturday ?? null,
    budget_sunday: settings?.budget_sunday ?? null,
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
