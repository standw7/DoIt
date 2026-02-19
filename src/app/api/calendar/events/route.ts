import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getAllCalendarEvents, createCalendarEvent } from "@/lib/google-calendar";
import { getGoogleAccessToken } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient();
  const accessToken = await getGoogleAccessToken(supabase);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Google calendar token expired. Please sign out and sign back in." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const timeMin = start ?? date ?? new Date().toISOString().split("T")[0];
  const timeMax = end ?? date ?? new Date().toISOString().split("T")[0];

  try {
    const allEvents = await getAllCalendarEvents(accessToken, timeMin, timeMax);
    return NextResponse.json({ events: allEvents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createApiClient();
  const accessToken = await getGoogleAccessToken(supabase);

  if (!accessToken) {
    return NextResponse.json({ error: "Google calendar token expired. Please sign out and sign back in." }, { status: 401 });
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
    const eventId = await createCalendarEvent(accessToken, settings.doit_calendar_id, body);
    return NextResponse.json({ eventId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
