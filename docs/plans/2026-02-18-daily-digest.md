# Daily Digest Email Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Send a nicely formatted daily email with today's tasks, time estimates, and weather forecast.

**Architecture:** Vercel cron triggers a Next.js API route each morning. The route queries tasks from Supabase using the service role key (bypasses RLS), fetches weather from Open-Meteo, renders a React email template, and sends via Resend. Users opt in and set their city in the settings page.

**Tech Stack:** Next.js 16, Supabase, Resend, @react-email/components, Open-Meteo API, Vercel Cron

---

### Task 1: Install dependencies

**Step 1: Install resend and react-email**

```bash
npm install resend @react-email/components
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add resend and react-email dependencies"
```

---

### Task 2: Database migration for digest settings

**Files:**
- Create: `supabase/migrations/005_digest_settings.sql`

**Step 1: Write the migration**

```sql
-- Add digest columns to user_settings
ALTER TABLE user_settings
  ADD COLUMN digest_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN digest_city TEXT,
  ADD COLUMN digest_latitude DOUBLE PRECISION,
  ADD COLUMN digest_longitude DOUBLE PRECISION;
```

**Step 2: Run migration in Supabase**

Copy and run the SQL in the Supabase SQL Editor at https://supabase.com/dashboard/project/dopbsgnhbwtahoaxzxrn/sql/new

Verify: Run `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name LIKE 'digest%';` — should return 4 rows.

**Step 3: Commit**

```bash
git add supabase/migrations/005_digest_settings.sql
git commit -m "feat: add digest settings columns to user_settings"
```

---

### Task 3: Update TypeScript types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add digest fields to UserSettings interface**

In `src/lib/types.ts`, add four fields to the `UserSettings` interface (after `doit_calendar_id`):

```typescript
export interface UserSettings {
  id: string;
  user_id: string;
  working_hours_start: string;
  working_hours_end: string;
  daily_minutes_budget: number;
  auto_assign_enabled: boolean;
  doit_calendar_id: string | null;
  digest_enabled: boolean;
  digest_city: string | null;
  digest_latitude: number | null;
  digest_longitude: number | null;
  created_at: string;
  updated_at: string;
}
```

No changes to `UserSettingsInsert` or `UserSettingsUpdate` — they derive from `UserSettings` via `Partial`/`Omit` and will automatically include the new fields.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add digest fields to UserSettings type"
```

---

### Task 4: Create weather utility

**Files:**
- Create: `src/lib/weather.ts`

**Step 1: Create the weather module**

This module has two functions:
1. `geocodeCity(city)` — calls Open-Meteo geocoding API, returns `{ latitude, longitude, displayName }`
2. `fetchWeather(lat, lon)` — calls Open-Meteo forecast API, returns today's weather summary

```typescript
// src/lib/weather.ts

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface WeatherForecast {
  temperatureMax: number; // Fahrenheit
  temperatureMin: number; // Fahrenheit
  precipitationProbability: number; // 0-100
  weatherDescription: string;
  weatherEmoji: string;
}

// WMO Weather interpretation codes → description + emoji
const WMO_CODES: Record<number, { description: string; emoji: string }> = {
  0: { description: "Clear sky", emoji: "☀️" },
  1: { description: "Mainly clear", emoji: "🌤" },
  2: { description: "Partly cloudy", emoji: "⛅" },
  3: { description: "Overcast", emoji: "☁️" },
  45: { description: "Foggy", emoji: "🌫" },
  48: { description: "Depositing rime fog", emoji: "🌫" },
  51: { description: "Light drizzle", emoji: "🌦" },
  53: { description: "Moderate drizzle", emoji: "🌦" },
  55: { description: "Dense drizzle", emoji: "🌧" },
  61: { description: "Slight rain", emoji: "🌦" },
  63: { description: "Moderate rain", emoji: "🌧" },
  65: { description: "Heavy rain", emoji: "🌧" },
  71: { description: "Slight snow", emoji: "🌨" },
  73: { description: "Moderate snow", emoji: "🌨" },
  75: { description: "Heavy snow", emoji: "❄️" },
  77: { description: "Snow grains", emoji: "❄️" },
  80: { description: "Slight rain showers", emoji: "🌦" },
  81: { description: "Moderate rain showers", emoji: "🌧" },
  82: { description: "Violent rain showers", emoji: "⛈" },
  85: { description: "Slight snow showers", emoji: "🌨" },
  86: { description: "Heavy snow showers", emoji: "❄️" },
  95: { description: "Thunderstorm", emoji: "⛈" },
  96: { description: "Thunderstorm with slight hail", emoji: "⛈" },
  99: { description: "Thunderstorm with heavy hail", emoji: "⛈" },
};

export async function geocodeCity(city: string): Promise<GeocodingResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.results?.length) return null;

  const result = data.results[0];
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    displayName: [result.name, result.admin1, result.country].filter(Boolean).join(", "),
  };
}

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherForecast | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const daily = data.daily;
  if (!daily) return null;

  const weatherCode = daily.weather_code[0] ?? 0;
  const wmo = WMO_CODES[weatherCode] ?? { description: "Unknown", emoji: "🌡" };

  return {
    temperatureMax: Math.round(daily.temperature_2m_max[0]),
    temperatureMin: Math.round(daily.temperature_2m_min[0]),
    precipitationProbability: daily.precipitation_probability_max[0] ?? 0,
    weatherDescription: wmo.description,
    weatherEmoji: wmo.emoji,
  };
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/weather.ts
git commit -m "feat: add weather utility with Open-Meteo geocoding and forecast"
```

---

### Task 5: Create the email template

**Files:**
- Create: `src/emails/daily-digest.tsx`

**Step 1: Create the React email template**

This is a React component using `@react-email/components` that renders a nicely formatted HTML email.

```tsx
// src/emails/daily-digest.tsx

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from "@react-email/components";
import { WeatherForecast } from "@/lib/weather";

interface DigestTask {
  name: string;
  description: string | null;
  estimated_minutes: number | null;
  priority: "low" | "medium" | "high";
}

interface DailyDigestEmailProps {
  date: string; // "Tuesday, February 18, 2026"
  tasks: DigestTask[];
  totalMinutes: number;
  weather: WeatherForecast | null;
  city: string | null;
  appUrl: string;
}

const priorityIndicator: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🔵",
};

function formatMin(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function DailyDigestEmail({
  date,
  tasks,
  totalMinutes,
  weather,
  city,
  appUrl,
}: DailyDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {tasks.length > 0
          ? `${tasks.length} task${tasks.length > 1 ? "s" : ""} today (${formatMin(totalMinutes)})`
          : "No tasks scheduled for today"}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Text style={heading}>Good morning ☀️</Text>
          <Text style={subheading}>{date}</Text>

          {/* Weather */}
          {weather && (
            <Section style={weatherCard}>
              <Text style={weatherText}>
                {weather.weatherEmoji} {city} — {weather.temperatureMin}°F / {weather.temperatureMax}°F
              </Text>
              <Text style={weatherDetail}>
                {weather.weatherDescription} · {weather.precipitationProbability}% chance of rain
              </Text>
            </Section>
          )}

          {/* Tasks */}
          {tasks.length > 0 ? (
            <>
              <Text style={sectionTitle}>
                Today&apos;s Tasks ({formatMin(totalMinutes)} total)
              </Text>
              <Hr style={divider} />
              {tasks.map((task, i) => (
                <Section key={i} style={taskRow}>
                  <Text style={taskName}>
                    {priorityIndicator[task.priority]} {task.name}
                    {task.estimated_minutes ? (
                      <span style={taskTime}> ({formatMin(task.estimated_minutes)})</span>
                    ) : null}
                  </Text>
                  {task.description && (
                    <Text style={taskDescription}>
                      {task.description.length > 120
                        ? task.description.slice(0, 120) + "..."
                        : task.description}
                    </Text>
                  )}
                </Section>
              ))}
            </>
          ) : (
            <Text style={emptyText}>No tasks scheduled for today. Enjoy your free day!</Text>
          )}

          <Hr style={divider} />
          <Link href={appUrl} style={ctaLink}>
            Open DoIt →
          </Link>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px 24px",
  maxWidth: "480px",
  borderRadius: "8px",
};

const heading = {
  fontSize: "22px",
  fontWeight: "600" as const,
  color: "#1a1a1a",
  margin: "0 0 4px",
};

const subheading = {
  fontSize: "14px",
  color: "#666",
  margin: "0 0 24px",
};

const weatherCard = {
  backgroundColor: "#f0f7ff",
  borderRadius: "8px",
  padding: "12px 16px",
  marginBottom: "24px",
};

const weatherText = {
  fontSize: "15px",
  fontWeight: "500" as const,
  color: "#1a1a1a",
  margin: "0 0 4px",
};

const weatherDetail = {
  fontSize: "13px",
  color: "#666",
  margin: "0",
};

const sectionTitle = {
  fontSize: "15px",
  fontWeight: "600" as const,
  color: "#1a1a1a",
  margin: "0 0 8px",
};

const divider = {
  borderColor: "#e6e6e6",
  margin: "16px 0",
};

const taskRow = {
  marginBottom: "12px",
};

const taskName = {
  fontSize: "14px",
  fontWeight: "500" as const,
  color: "#1a1a1a",
  margin: "0 0 2px",
};

const taskTime = {
  fontWeight: "400" as const,
  color: "#888",
};

const taskDescription = {
  fontSize: "12px",
  color: "#888",
  margin: "2px 0 0 22px",
  lineHeight: "1.4",
};

const emptyText = {
  fontSize: "14px",
  color: "#888",
  textAlign: "center" as const,
  padding: "24px 0",
};

const ctaLink = {
  display: "block",
  textAlign: "center" as const,
  color: "#2563eb",
  fontSize: "14px",
  fontWeight: "500" as const,
  textDecoration: "none",
};
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/emails/daily-digest.tsx
git commit -m "feat: add daily digest email template"
```

---

### Task 6: Create Supabase admin client

**Files:**
- Create: `src/lib/supabase/admin.ts`

The digest API route runs from a Vercel cron (no user session). It needs a Supabase client with the **service role key** to bypass RLS and query all users who have digest enabled.

**Step 1: Create the admin client**

```typescript
// src/lib/supabase/admin.ts

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
```

**Step 2: Commit**

```bash
git add src/lib/supabase/admin.ts
git commit -m "feat: add Supabase admin client for server-side cron routes"
```

---

### Task 7: Create the digest API route

**Files:**
- Create: `src/app/api/digest/send/route.ts`

This is the core route that Vercel cron calls every morning. It:
1. Verifies the `CRON_SECRET` header
2. Queries all users with `digest_enabled = true`
3. For each user: fetches today's tasks, fetches weather, renders email, sends via Resend

**Step 1: Create the route**

```typescript
// src/app/api/digest/send/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWeather } from "@/lib/weather";
import { DailyDigestEmail } from "@/emails/daily-digest";
import { Resend } from "resend";
import { format } from "date-fns";

const resend = new Resend(process.env.RESEND_API_KEY!);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://getdoit.vercel.app";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/digest/send/route.ts
git commit -m "feat: add daily digest API route with cron auth"
```

---

### Task 8: Add digest settings to the UI

**Files:**
- Modify: `src/components/schedule/settings-panel.tsx`
- Modify: `src/hooks/use-settings.ts`

**Step 1: Update the useSettings hook**

In `src/hooks/use-settings.ts`, add digest defaults and expose them in `effectiveSettings`:

Add to `DEFAULT_SETTINGS`:
```typescript
digest_enabled: false,
digest_city: null as string | null,
digest_latitude: null as number | null,
digest_longitude: null as number | null,
```

Add to `effectiveSettings`:
```typescript
digest_enabled: settings?.digest_enabled ?? DEFAULT_SETTINGS.digest_enabled,
digest_city: settings?.digest_city ?? DEFAULT_SETTINGS.digest_city,
digest_latitude: settings?.digest_latitude ?? DEFAULT_SETTINGS.digest_latitude,
digest_longitude: settings?.digest_longitude ?? DEFAULT_SETTINGS.digest_longitude,
```

**Step 2: Add the Daily Digest card to SettingsPanel**

In `src/components/schedule/settings-panel.tsx`:

Update the `SettingsPanelProps` interface to include digest fields:
```typescript
interface SettingsPanelProps {
  // ... existing props ...
  digestEnabled: boolean;
  digestCity: string | null;
  digestLatitude: number | null;
  digestLongitude: number | null;
  onUpdate: (updates: UserSettingsUpdate) => Promise<void>;
  onSetupCalendar: () => Promise<string>;
}
```

Add these imports:
```typescript
import { Mail, MapPin } from "lucide-react";
import { geocodeCity } from "@/lib/weather";
```

Add state and handler inside the component:
```typescript
const [localCity, setLocalCity] = useState(digestCity ?? "");
const [verifying, setVerifying] = useState(false);
const [verifiedLocation, setVerifiedLocation] = useState<string | null>(
  digestLatitude && digestCity ? `${digestCity} ✓` : null
);

async function handleVerifyCity() {
  if (!localCity.trim()) return;
  setVerifying(true);
  try {
    const result = await geocodeCity(localCity.trim());
    if (result) {
      await onUpdate({
        digest_city: localCity.trim(),
        digest_latitude: result.latitude,
        digest_longitude: result.longitude,
      });
      setVerifiedLocation(result.displayName);
      toast.success(`Location set to ${result.displayName}`);
    } else {
      toast.error("City not found — try a different name");
    }
  } catch {
    toast.error("Failed to verify city");
  } finally {
    setVerifying(false);
  }
}

async function handleDigestToggle(checked: boolean) {
  try {
    await onUpdate({ digest_enabled: checked });
  } catch {
    toast.error("Failed to update setting");
  }
}
```

Add a new `Card` section AFTER the existing settings card in the JSX return (this is a separate card, not inside the existing one). Add it after the closing `</Card>` of the existing settings:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2 text-base">
      <Mail className="h-4 w-4" />
      Daily Digest
    </CardTitle>
    <p className="text-xs text-muted-foreground">
      Get a morning email with your tasks and weather forecast
    </p>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Enable toggle */}
    <div className="flex items-center justify-between">
      <Label htmlFor="digest-toggle">Send daily digest email</Label>
      <Switch
        id="digest-toggle"
        checked={digestEnabled}
        onCheckedChange={handleDigestToggle}
      />
    </div>

    {/* City input */}
    {digestEnabled && (
      <div className="space-y-2">
        <Label>City for weather</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={localCity}
              onChange={(e) => {
                setLocalCity(e.target.value);
                setVerifiedLocation(null);
              }}
              placeholder="e.g. Seattle"
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerifyCity}
            disabled={verifying || !localCity.trim()}
          >
            {verifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Verify"
            )}
          </Button>
        </div>
        {verifiedLocation && (
          <p className="text-xs text-green-600">
            ✓ {verifiedLocation}
          </p>
        )}
      </div>
    )}
  </CardContent>
</Card>
```

**Step 3: Update the settings page to pass digest props**

In `src/app/(app)/settings/page.tsx`, update the `<SettingsPanel>` call to include the new props:

```tsx
<SettingsPanel
  workingHoursStart={settings.working_hours_start}
  workingHoursEnd={settings.working_hours_end}
  dailyBudget={settings.daily_minutes_budget}
  autoAssignEnabled={settings.auto_assign_enabled}
  calendarConnected={calendarConnected}
  digestEnabled={settings.digest_enabled}
  digestCity={settings.digest_city}
  digestLatitude={settings.digest_latitude}
  digestLongitude={settings.digest_longitude}
  onUpdate={updateSettings}
  onSetupCalendar={setupCalendar}
/>
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Test in browser**

Navigate to http://localhost:3000/settings. You should see a new "Daily Digest" card with a toggle and city input. Enable the toggle, type a city, click Verify. Should show a green checkmark with the resolved location.

**Step 6: Commit**

```bash
git add src/hooks/use-settings.ts src/components/schedule/settings-panel.tsx src/app/(app)/settings/page.tsx
git commit -m "feat: add daily digest settings UI with city geocoding"
```

---

### Task 9: Create vercel.json with cron config

**Files:**
- Create: `vercel.json`

**Step 1: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/digest/send",
      "schedule": "0 13 * * *"
    }
  ]
}
```

Note: `0 13 * * *` = 1 PM UTC = 7 AM CST. Adjust as needed for the user's timezone.

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel cron for daily digest at 7 AM CST"
```

---

### Task 10: Set environment variables and deploy

**Step 1: Get the Supabase service role key**

Go to Supabase dashboard → Project Settings → API → copy the `service_role` key (the secret one, NOT the anon key).

**Step 2: Sign up for Resend and get API key**

Go to https://resend.com, sign up, create an API key. Free tier = 100 emails/day.

**Step 3: Generate a cron secret**

```bash
openssl rand -hex 32
```

**Step 4: Set env vars on Vercel**

```bash
echo "<service-role-key>" | vercel env add SUPABASE_SERVICE_ROLE_KEY production
echo "<resend-api-key>" | vercel env add RESEND_API_KEY production
echo "<cron-secret>" | vercel env add CRON_SECRET production
echo "https://getdoit.vercel.app" | vercel env add NEXT_PUBLIC_APP_URL production
```

**Step 5: Deploy**

```bash
git push
vercel --prod --yes
```

**Step 6: Test the digest endpoint manually**

```bash
curl -H "Authorization: Bearer <cron-secret>" https://getdoit.vercel.app/api/digest/send
```

Should return `{"sent": 1}` if you have digest enabled in settings with tasks for today, or `{"sent": 0}` if not.

**Step 7: Commit any remaining changes and push**

```bash
git push
```
