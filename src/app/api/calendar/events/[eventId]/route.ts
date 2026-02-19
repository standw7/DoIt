import { NextRequest, NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { deleteCalendarEvent, updateCalendarEvent } from "@/lib/google-calendar";
import { getGoogleAccessToken } from "@/lib/google-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = await createApiClient();
  const accessToken = await getGoogleAccessToken(supabase);

  if (!accessToken) {
    return NextResponse.json({ error: "Google calendar token expired" }, { status: 401 });
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
    await updateCalendarEvent(
      accessToken,
      settings.doit_calendar_id,
      eventId,
      { startDateTime: body.startDateTime, endDateTime: body.endDateTime }
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const supabase = await createApiClient();
  const accessToken = await getGoogleAccessToken(supabase);

  if (!accessToken) {
    return NextResponse.json({ error: "Google calendar token expired" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("doit_calendar_id")
    .single();

  if (!settings?.doit_calendar_id) {
    return NextResponse.json({ error: "DoIt calendar not set up" }, { status: 400 });
  }

  try {
    await deleteCalendarEvent(accessToken, settings.doit_calendar_id, eventId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
