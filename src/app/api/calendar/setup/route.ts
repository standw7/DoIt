import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { createDoItCalendar } from "@/lib/google-calendar";
import { getGoogleAccessToken } from "@/lib/google-auth";

export async function POST() {
  const supabase = await createApiClient();
  const accessToken = await getGoogleAccessToken(supabase);

  if (!accessToken) {
    return NextResponse.json(
      { error: "No Google token — please sign out and sign back in to grant calendar access" },
      { status: 401 }
    );
  }

  try {
    const calendarId = await createDoItCalendar(accessToken);

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
      const { error } = await supabase.from("user_settings").insert({
        user_id: user.id,
        doit_calendar_id: calendarId,
      });
      if (error) {
        return NextResponse.json(
          { error: `Database error: ${error.message}. Have you run migration 002?` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ calendarId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
