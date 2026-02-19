import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWeather } from "@/lib/weather";
import { DailyDigestEmail } from "@/emails/daily-digest";
import { Resend } from "resend";
import { format } from "date-fns";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = getResend();
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://getdoit.vercel.app";
  const supabase = createAdminClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const dateDisplay = format(new Date(), "EEEE, MMMM d, yyyy");

  // Get all users with digest enabled
  const { data: settingsRows, error: settingsError } = await supabase
    .from("user_settings")
    .select("user_id, digest_city, digest_latitude, digest_longitude")
    .eq("digest_enabled", true);

  if (settingsError || !settingsRows?.length) {
    return NextResponse.json({ sent: 0, message: "No users with digest enabled" });
  }

  let sentCount = 0;

  for (const row of settingsRows) {
    try {
      // Get user email from auth.users
      const { data: { user } } = await supabase.auth.admin.getUserById(row.user_id);
      if (!user?.email) continue;

      // Get today's tasks for this user
      const { data: tasks } = await supabase
        .from("tasks")
        .select("name, description, estimated_minutes, priority")
        .eq("user_id", row.user_id)
        .eq("day", today)
        .neq("status", "done")
        .neq("status", "skipped")
        .order("priority", { ascending: false })
        .order("sort_order", { ascending: true });

      const taskList = tasks ?? [];
      const totalMinutes = taskList.reduce(
        (sum, t) => sum + (t.estimated_minutes ?? 0),
        0
      );

      // Fetch weather if coordinates are set
      let weather = null;
      if (row.digest_latitude && row.digest_longitude) {
        weather = await fetchWeather(row.digest_latitude, row.digest_longitude);
      }

      // Send email
      await resend.emails.send({
        from: "DoIt <digest@getdoit.vercel.app>",
        to: user.email,
        subject: taskList.length > 0
          ? `${taskList.length} task${taskList.length > 1 ? "s" : ""} for today`
          : "Your daily digest — no tasks today",
        react: DailyDigestEmail({
          date: dateDisplay,
          tasks: taskList,
          totalMinutes,
          weather,
          city: row.digest_city,
          appUrl: APP_URL,
        }),
      });

      sentCount++;
    } catch (err) {
      console.error(`Failed to send digest to user ${row.user_id}:`, err);
    }
  }

  return NextResponse.json({ sent: sentCount });
}
