import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Grab the session to capture the Google refresh token
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_refresh_token) {
        // Store the Google refresh token so we can refresh access tokens later
        await supabase
          .from("user_settings")
          .update({ google_refresh_token: session.provider_refresh_token })
          .eq("user_id", session.user.id);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
