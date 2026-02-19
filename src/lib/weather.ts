// Weather utility — Open-Meteo geocoding + forecast (no API key required)

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

/** WMO weather interpretation codes → human description + emoji */
const WMO_CODES: Record<number, { description: string; emoji: string }> = {
  0: { description: "Clear sky", emoji: "\u2600\uFE0F" },
  1: { description: "Mainly clear", emoji: "\uD83C\uDF24" },
  2: { description: "Partly cloudy", emoji: "\u26C5" },
  3: { description: "Overcast", emoji: "\u2601\uFE0F" },
  45: { description: "Fog", emoji: "\uD83C\uDF2B" },
  48: { description: "Depositing rime fog", emoji: "\uD83C\uDF2B" },
  51: { description: "Light drizzle", emoji: "\uD83C\uDF26" },
  53: { description: "Moderate drizzle", emoji: "\uD83C\uDF27" },
  55: { description: "Dense drizzle", emoji: "\uD83C\uDF27" },
  61: { description: "Slight rain", emoji: "\uD83C\uDF26" },
  63: { description: "Moderate rain", emoji: "\uD83C\uDF27" },
  65: { description: "Heavy rain", emoji: "\uD83C\uDF27" },
  71: { description: "Slight snow", emoji: "\uD83C\uDF28" },
  73: { description: "Moderate snow", emoji: "\uD83C\uDF28" },
  75: { description: "Heavy snow", emoji: "\u2744\uFE0F" },
  80: { description: "Slight rain showers", emoji: "\uD83C\uDF26" },
  81: { description: "Moderate rain showers", emoji: "\uD83C\uDF27" },
  82: { description: "Violent rain showers", emoji: "\u26C8" },
  85: { description: "Slight snow showers", emoji: "\uD83C\uDF28" },
  86: { description: "Heavy snow showers", emoji: "\u2744\uFE0F" },
  95: { description: "Thunderstorm", emoji: "\u26C8" },
  96: { description: "Thunderstorm with slight hail", emoji: "\u26C8" },
  99: { description: "Thunderstorm with heavy hail", emoji: "\u26C8" },
};

/**
 * Look up a city name via the Open-Meteo geocoding API.
 * Returns the top match with lat/lon and a human-readable display name,
 * or null if no results are found.
 */
export async function geocodeCity(
  city: string
): Promise<GeocodingResult | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const results = data?.results;
  if (!Array.isArray(results) || results.length === 0) return null;

  const r = results[0];
  const displayName = [r.name, r.admin1, r.country]
    .filter(Boolean)
    .join(", ");

  return {
    latitude: r.latitude,
    longitude: r.longitude,
    displayName,
  };
}

/**
 * Fetch today's weather forecast for a given lat/lon from the Open-Meteo API.
 * Returns a summary object or null on failure.
 */
export async function fetchWeather(
  lat: number,
  lon: number
): Promise<WeatherForecast | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code"
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json();
  const daily = data?.daily;
  if (!daily) return null;

  const weatherCode: number = daily.weather_code?.[0] ?? 0;
  const wmo = WMO_CODES[weatherCode] ?? {
    description: "Unknown",
    emoji: "\u2753",
  };

  return {
    temperatureMax: daily.temperature_2m_max?.[0] ?? 0,
    temperatureMin: daily.temperature_2m_min?.[0] ?? 0,
    precipitationProbability: daily.precipitation_probability_max?.[0] ?? 0,
    weatherDescription: wmo.description,
    weatherEmoji: wmo.emoji,
  };
}
