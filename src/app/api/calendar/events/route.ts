import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getAllCalendarEvents, createCalendarEvent } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json({ error: "Not authenticated or no calendar access" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const timeMin = start ?? date ?? new Date().toISOString().split("T")[0];
  const timeMax = end ?? date ?? new Date().toISOString().split("T")[0];

  try {
    // Fetch events from ALL calendars the user has access to
    const allEvents = await getAllCalendarEvents(
      session.provider_token,
      timeMin,
      timeMax
    );

    return NextResponse.json({ events: allEvents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createApiClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("doit_calendar_id")
    .single();

  if (!settings?.doit_calendar_id) {
    return NextResponse.json({ error: "DoIt calendar not set up" }, { status: 400 });
  }

  const body = await request.json();
  try {
    const eventId = await createCalendarEvent(
      session.provider_token,
      settings.doit_calendar_id,
      body
    );
    return NextResponse.json({ eventId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
