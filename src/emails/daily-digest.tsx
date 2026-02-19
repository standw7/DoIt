import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { WeatherForecast } from "@/lib/weather";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DigestTask {
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMin(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const PRIORITY_DOT: Record<DigestTask["priority"], string> = {
  high: "\uD83D\uDD34",
  medium: "\uD83D\uDFE1",
  low: "\uD83D\uDD35",
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  maxWidth: "480px",
  margin: "0 auto",
  borderRadius: "8px",
  padding: "32px 24px",
};

const heading: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: "0 0 4px 0",
};

const dateStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  margin: "0 0 24px 0",
};

const weatherCard: React.CSSProperties = {
  backgroundColor: "#f0f7ff",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "24px",
};

const weatherHeadline: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#1a1a1a",
  margin: "0 0 4px 0",
};

const weatherDetail: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "0",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 600,
  color: "#1a1a1a",
  margin: "0 0 12px 0",
};

const taskRow: React.CSSProperties = {
  marginBottom: "16px",
};

const taskName: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#1a1a1a",
  margin: "0 0 2px 0",
};

const taskTime: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 400,
  color: "#6b7280",
};

const taskDescription: React.CSSProperties = {
  fontSize: "13px",
  color: "#6b7280",
  margin: "2px 0 0 0",
  lineHeight: "1.4",
};

const emptyState: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  textAlign: "center" as const,
  padding: "24px 0",
};

const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "12px 0",
};

const footerLink: React.CSSProperties = {
  fontSize: "14px",
  color: "#3b82f6",
  textDecoration: "none",
  fontWeight: 600,
};

// ── Component ──────────────────────────────────────────────────────────────────

export function DailyDigestEmail({
  date,
  tasks,
  totalMinutes,
  weather,
  city,
  appUrl,
}: DailyDigestEmailProps) {
  const previewText =
    tasks.length > 0
      ? `${tasks.length} task${tasks.length === 1 ? "" : "s"} today \u00B7 ${formatMin(totalMinutes)} total`
      : "No tasks scheduled for today";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Heading style={heading}>Good morning \u2600\uFE0F</Heading>
          <Text style={dateStyle}>{date}</Text>

          {/* Weather card */}
          {weather && city && (
            <Section style={weatherCard}>
              <Text style={weatherHeadline}>
                {weather.weatherEmoji} {city} &mdash;{" "}
                {Math.round(weather.temperatureMin)}&deg;F /{" "}
                {Math.round(weather.temperatureMax)}&deg;F
              </Text>
              <Text style={weatherDetail}>
                {weather.weatherDescription} &middot;{" "}
                {weather.precipitationProbability}% chance of rain
              </Text>
            </Section>
          )}

          {/* Tasks section */}
          <Text style={sectionTitle}>
            Today&apos;s Tasks ({formatMin(totalMinutes)} total)
          </Text>
          <Hr style={hr} />

          {tasks.length > 0 ? (
            tasks.map((task, i) => {
              const dot = PRIORITY_DOT[task.priority];
              const snippet = task.description
                ? task.description.length > 120
                  ? task.description.slice(0, 120) + "\u2026"
                  : task.description
                : null;

              return (
                <Section key={i} style={taskRow}>
                  <Text style={taskName}>
                    {dot} {task.name}
                    {task.estimated_minutes != null && (
                      <span style={taskTime}>
                        {" "}
                        ({formatMin(task.estimated_minutes)})
                      </span>
                    )}
                  </Text>
                  {snippet && <Text style={taskDescription}>{snippet}</Text>}
                </Section>
              );
            })
          ) : (
            <Text style={emptyState}>
              No tasks scheduled for today. Enjoy your free day!
            </Text>
          )}

          {/* Footer */}
          <Hr style={hr} />
          <Link href={appUrl} style={footerLink}>
            Open DoIt &rarr;
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
