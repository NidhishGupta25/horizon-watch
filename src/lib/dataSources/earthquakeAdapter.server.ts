/**
 * USGS FDSN earthquake adapter.
 *
 * Keyless public API. Polls the last 24 h of M3.0+ events inside the Indian
 * bounding box and upserts them into `live_disasters` keyed on the USGS event
 * id, so re-polling the same window never duplicates rows.
 */

export const USGS_ENDPOINT = "https://earthquake.usgs.gov/fdsnws/event/1/query";

export const INDIA_BBOX = {
  minlatitude: 6,
  maxlatitude: 38,
  minlongitude: 68,
  maxlongitude: 98,
} as const;

export type Severity = "Low" | "Moderate" | "High" | "Extreme";

export interface QuakeEvent {
  externalId: string;
  magnitude: number;
  place: string;
  timestamp: string;
  lat: number;
  lng: number;
  depthKm: number | null;
  tsunami: boolean;
  usgsAlert: string | null;
  severity: Severity;
}

/** USGS magnitude bands mandated by the spec. */
export function severityForMagnitude(mag: number): Severity {
  if (mag >= 7.0) return "Extreme";
  if (mag >= 5.5) return "High";
  if (mag >= 4.0) return "Moderate";
  return "Low";
}

export function buildQueryUrl(now = new Date()): string {
  const params = new URLSearchParams({
    format: "geojson",
    starttime: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    endtime: now.toISOString(),
    minlatitude: String(INDIA_BBOX.minlatitude),
    maxlatitude: String(INDIA_BBOX.maxlatitude),
    minlongitude: String(INDIA_BBOX.minlongitude),
    maxlongitude: String(INDIA_BBOX.maxlongitude),
    minmagnitude: "3.0",
    orderby: "time",
  });
  return `${USGS_ENDPOINT}?${params.toString()}`;
}

/** Pure parser — unit tested against a saved fixture, never hits the network. */
export function parseUsgsGeoJson(payload: unknown): QuakeEvent[] {
  const features = (payload as { features?: unknown[] })?.features;
  if (!Array.isArray(features)) throw new Error("USGS payload has no features array");

  const events: QuakeEvent[] = [];
  for (const raw of features) {
    const feature = raw as {
      id?: string;
      properties?: { mag?: number | null; place?: string | null; time?: number | null; tsunami?: number; alert?: string | null };
      geometry?: { coordinates?: number[] };
    };
    const id = feature.id;
    const props = feature.properties ?? {};
    const coords = feature.geometry?.coordinates;
    const mag = typeof props.mag === "number" ? props.mag : null;
    if (!id || mag === null || !Array.isArray(coords) || coords.length < 2) continue;

    const [lon, lat, depth] = coords as [number, number, number?];
    if (typeof lon !== "number" || typeof lat !== "number") continue;

    events.push({
      externalId: id,
      magnitude: mag,
      place: props.place ?? "Unnamed epicentre",
      timestamp: new Date(typeof props.time === "number" ? props.time : Date.now()).toISOString(),
      lat,
      lng: lon,
      depthKm: typeof depth === "number" ? depth : null,
      tsunami: props.tsunami === 1,
      usgsAlert: props.alert ?? null,
      severity: severityForMagnitude(mag),
    });
  }
  return events;
}

export async function fetchEarthquakes(now = new Date(), timeoutMs = 15000): Promise<QuakeEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(buildQueryUrl(now), {
      signal: controller.signal,
      headers: { Accept: "application/geo+json,application/json" },
    });
    if (!res.ok) throw new Error(`USGS responded ${res.status}`);
    const json = await res.json();
    return parseUsgsGeoJson(json);
  } finally {
    clearTimeout(timer);
  }
}

/** Row shape written to the existing `live_disasters` table. */
export function toDisasterRow(event: QuakeEvent) {
  return {
    external_id: event.externalId,
    dedupe_hash: `usgs:${event.externalId}`,
    title: `M${event.magnitude.toFixed(1)} earthquake — ${event.place}`,
    description: [
      `Magnitude ${event.magnitude.toFixed(1)}`,
      event.depthKm !== null ? `depth ${event.depthKm.toFixed(0)} km` : null,
      event.tsunami ? "tsunami flag set by USGS" : null,
      event.usgsAlert ? `USGS PAGER alert: ${event.usgsAlert}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    pub_date: event.timestamp,
    hazard_type: "Earthquake",
    district: event.place,
    state: null as string | null,
    lat: event.lat,
    lng: event.lng,
    geocode_source: "usgs",
    severity: event.severity,
    source: "USGS",
    mode: "live",
  };
}
