import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { createDoItCalendar } from "@/lib/google-calendar";

export async function POST() {
  const supabase = await createApiClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const calendarId = await createDoItCalendar(session.provider_token);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No user" }, { status: 401 });

    const { data: existing } = await supabase
      .from("user_settings")
      .select("id")
      .single();

    if (existing) {
      await supabase
        .from("user_settings")
        .update({ doit_calendar_id: calendarId })
        .eq("user_id", user.id);
    } else {
      await supabase.from("user_settings").insert({
        user_id: user.id,
        doit_calendar_id: calendarId,
      });
    }

    return NextResponse.json({ calendarId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
