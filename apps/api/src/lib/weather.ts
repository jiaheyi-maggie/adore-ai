import type { WeatherContext } from '@adore/shared';

/**
 * Fetches current weather from OpenWeather API (free tier).
 * Returns null if API key is not configured or request fails.
 * Never throws — weather is a nice-to-have, not a blocker.
 */
export async function getWeather(
  lat: number,
  lon: number
): Promise<WeatherContext | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'imperial'); // Fahrenheit

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      main: { temp: number; feels_like: number; humidity: number };
      weather: { main: string; description: string }[];
      wind: { speed: number };
      clouds: { all: number };
      rain?: { '1h'?: number };
    };

    // Map OpenWeather condition to simple string
    const rawCondition = data.weather?.[0]?.main?.toLowerCase() ?? 'unknown';
    const conditionMap: Record<string, string> = {
      clear: 'sunny',
      clouds: 'cloudy',
      rain: 'rain',
      drizzle: 'rain',
      thunderstorm: 'thunderstorm',
      snow: 'snow',
      mist: 'foggy',
      fog: 'foggy',
      haze: 'hazy',
    };

    return {
      temperature_f: Math.round(data.main.temp),
      feels_like_f: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      precipitation_chance: data.rain?.['1h'] ? Math.min(100, Math.round(data.rain['1h'] * 100)) : 0,
      uv_index: 0, // OpenWeather free tier doesn't include UV; would need One Call API
      wind_speed_mph: Math.round(data.wind.speed),
      condition: conditionMap[rawCondition] ?? rawCondition,
    };
  } catch {
    // Non-fatal — weather is optional
    return null;
  }
}
