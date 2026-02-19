import { SupabaseClient } from "@supabase/supabase-js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Get a valid Google access token, refreshing if needed.
 * 1. Try the session's provider_token (works for ~1 hour after login)
 * 2. Try Supabase refreshSession()
 * 3. Use the stored Google refresh token to get a new access token directly
 */
export async function getGoogleAccessToken(
  supabase: SupabaseClient
): Promise<string | null> {
  // 1. Check current session
  let { data: { session } } = await supabase.auth.getSession();
  if (session?.provider_token) {
    return session.provider_token;
  }

  // 2. Try refreshing the Supabase session
  if (session) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.provider_token) {
      return refreshed.session.provider_token;
    }
    session = refreshed.session ?? session;
  }

  if (!session) return null;

  // 3. Use stored refresh token to get a new Google access token
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("google_refresh_token")
    .eq("user_id", session.user.id)
    .single();

  const refreshToken = settings?.google_refresh_token;
  if (!refreshToken) return null;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.access_token ?? null;
}
