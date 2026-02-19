"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserSettings, UserSettingsUpdate } from "@/lib/types";

const DEFAULT_SETTINGS = {
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  daily_minutes_budget: 120,
  auto_assign_enabled: true,
  doit_calendar_id: null as string | null,
  digest_enabled: false,
  digest_city: null as string | null,
  digest_latitude: null as number | null,
  digest_longitude: null as number | null,
};

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .single();

    if (data) {
      setSettings(data as UserSettings);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function updateSettings(updates: UserSettingsUpdate) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .single();

    if (existing) {
      const { error } = await supabase
        .from("user_settings")
        .update(updates)
        .eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("user_settings")
        .insert({ ...DEFAULT_SETTINGS, ...updates, user_id: user.id });
      if (error) throw error;
    }

    await fetchSettings();
  }

  async function setupCalendar() {
    const res = await fetch("/api/calendar/setup", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Setup failed (${res.status})`);
    }
    const { calendarId } = await res.json();
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
    digest_enabled: settings?.digest_enabled ?? DEFAULT_SETTINGS.digest_enabled,
    digest_city: settings?.digest_city ?? DEFAULT_SETTINGS.digest_city,
    digest_latitude: settings?.digest_latitude ?? DEFAULT_SETTINGS.digest_latitude,
    digest_longitude: settings?.digest_longitude ?? DEFAULT_SETTINGS.digest_longitude,
  };

  return {
    settings: effectiveSettings,
    loading,
    calendarConnected,
    updateSettings,
    setupCalendar,
  };
}
