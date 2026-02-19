import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getAllCalendarEvents, createCalendarEvent } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const supabase = await createApiClient();
  let { data: { session } } = await supabase.auth.getSession();

  // If provider_token is missing, try refreshing the session to get a new one
  if (session && !session.provider_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.provider_token) {
      session = refreshed.session;
    }
  }

  if (!session?.provider_token) {
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
  let { data: { session } } = await supabase.auth.getSession();

  if (session && !session.provider_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.provider_token) {
      session = refreshed.session;
    }
  }

  if (!session?.provider_token) {
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
