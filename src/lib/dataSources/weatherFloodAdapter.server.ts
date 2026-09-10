/**
 * Open-Meteo adapter: forecast (precipitation / wind / pressure) + GloFAS river
 * discharge. Both endpoints are keyless.
 *
 * CYCLONE CAVEAT — READ BEFORE EXTENDING:
 * Open-Meteo exposes NO named-storm or cyclone-track product. The wind and
 * pressure numbers produced here are raw severity-model INPUTS (a cyclone
 * *precursor* signal) and must never be surfaced, labelled, or consumed as a
 * real cyclone tracker. A genuine tracker needs IMD / JTWC / GDACS.
 *
 * FLOOD CAVEAT:
 * GloFAS river discharge is only meaningful when the queried coordinate sits on
 * or beside an actual river channel. A zone flagged flood-prone whose sample
 * point is off-channel, or whose discharge comes back implausibly near zero, is
 * logged as an ERROR — never as "no flood risk".
 */

export const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
export const FLOOD_ENDPOINT = "https://flood-api.open-meteo.com/v1/flood";

/** Below this m³/s a "flood-prone" river point is treated as an invalid signal. */
export const MIN_PLAUSIBLE_DISCHARGE = 1.0;

export interface HazardZoneRow {
  id: string;
  name: string;
  disaster_type: string;
  sample_lat: number;
  sample_lng: number;
  on_river_channel: boolean;
  river_name: string | null;
  flood_prone: boolean;
  slope_index: number;
  soil_saturation: number;
}

export interface ForecastSignal {
  rainfallMm: number;
  peakRainfallIntensityMmH: number;
  peakWindKmh: number;
  minPressureHpa: number | null;
}

export interface FloodSignal {
  peakDischarge: number;
  meanDischarge: number;
}

export function buildForecastUrl(lat: number, lon: number): string {
  return `${FORECAST_ENDPOINT}?latitude=${lat}&longitude=${lon}&hourly=precipitation,windspeed_10m,pressure_msl&forecast_days=7`;
}

export function buildFloodUrl(lat: number, lon: number): string {
  return `${FLOOD_ENDPOINT}?latitude=${lat}&longitude=${lon}&daily=river_discharge&forecast_days=14`;
}

/** Pure parser — unit tested against a fixture. */
export function parseForecast(payload: unknown): ForecastSignal {
  const hourly = (payload as { hourly?: Record<string, unknown> })?.hourly;
  const precipitation = hourly?.["precipitation"];
  const wind = hourly?.["windspeed_10m"];
  const pressure = hourly?.["pressure_msl"];
  if (!Array.isArray(precipitation) || !Array.isArray(wind)) {
    throw new Error("Open-Meteo forecast payload missing hourly series");
  }

  const rain = precipitation.filter((v): v is number => typeof v === "number");
  const winds = wind.filter((v): v is number => typeof v === "number");
  const pressures = Array.isArray(pressure) ? pressure.filter((v): v is number => typeof v === "number") : [];

  return {
    rainfallMm: Number(rain.reduce((a, b) => a + b, 0).toFixed(2)),
    peakRainfallIntensityMmH: rain.length ? Math.max(...rain) : 0,
    peakWindKmh: winds.length ? Math.max(...winds) : 0,
    minPressureHpa: pressures.length ? Math.min(...pressures) : null,
  };
}

/** Pure parser — unit tested against a fixture. */
export function parseFlood(payload: unknown): FloodSignal {
  const daily = (payload as { daily?: Record<string, unknown> })?.daily;
  const discharge = daily?.["river_discharge"];
  if (!Array.isArray(discharge)) throw new Error("Open-Meteo flood payload missing river_discharge");
  const values = discharge.filter((v): v is number => typeof v === "number");
  if (values.length === 0) return { peakDischarge: 0, meanDischarge: 0 };
  return {
    peakDischarge: Math.max(...values),
    meanDischarge: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)),
  };
}

/**
 * Landslide risk is derived, not fetched — no live landslide source exists.
 * risk = normalised rainfall intensity × static slope × static soil saturation.
 */
export function landslideRisk(rainfallIntensityMmH: number, slopeIndex: number, soilSaturation: number): number {
  const intensity = Math.min(rainfallIntensityMmH / 30, 1);
  return Number(Math.min(intensity * (0.4 + slopeIndex) * (0.5 + soilSaturation), 1).toFixed(3));
}

export interface ZoneResult {
  zoneId: string;
  hazardType: string;
  forecast: ForecastSignal;
  flood: FloodSignal | null;
  landslide: number | null;
  floodSignalValid: boolean;
  floodError: string | null;
}

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchZoneSignals(zone: HazardZoneRow, timeoutMs = 15000): Promise<ZoneResult> {
  const forecast = parseForecast(await getJson(buildForecastUrl(zone.sample_lat, zone.sample_lng), timeoutMs));

  let flood: FloodSignal | null = null;
  let floodError: string | null = null;
  let floodSignalValid = false;

  const needsFlood = zone.flood_prone || zone.disaster_type === "flood";
  if (needsFlood) {
    if (!zone.on_river_channel) {
      floodError = `Sample point for ${zone.id} is not validated against a river channel — GloFAS discharge is not trustworthy here.`;
    } else {
      flood = parseFlood(await getJson(buildFloodUrl(zone.sample_lat, zone.sample_lng), timeoutMs));
      if (flood.peakDischarge < MIN_PLAUSIBLE_DISCHARGE) {
        floodError = `Discharge for flood-prone zone ${zone.id} is implausibly low (${flood.peakDischarge} m³/s) — treating as an invalid signal, not as "no flood risk".`;
      } else {
        floodSignalValid = true;
      }
    }
  }

  return {
    zoneId: zone.id,
    hazardType: zone.disaster_type,
    forecast,
    flood,
    landslide:
      zone.disaster_type === "landslide"
        ? landslideRisk(forecast.peakRainfallIntensityMmH, zone.slope_index, zone.soil_saturation)
        : null,
    floodSignalValid,
    floodError,
  };
}
