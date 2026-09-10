/**
 * Data-source orchestrator.
 *
 * Runs the USGS and Open-Meteo adapters on independent schedules. One
 * adapter's failure never blocks the other, and a failure NEVER overwrites
 * seeded or last-good data — it only writes a `data_source_log` row with
 * status "error", leaving the previous state in place (degraded).
 *
 * Scheduling note: this app runs on a stateless edge runtime, so there is no
 * long-lived node-cron process. The cadence is enforced durably from the last
 * successful `fetched_at` in `data_source_log` (earthquake: every
 * POLL_INTERVAL_EARTHQUAKE_MIN minutes, weather/flood: every
 * POLL_INTERVAL_WEATHER_HOURS hours) and the run is kicked by the scheduled
 * hook route. Neither API is ever polled more often than the configured
 * interval.
 */

import { fetchEarthquakes, toDisasterRow } from "./earthquakeAdapter.server";
import { fetchZoneSignals, type HazardZoneRow } from "./weatherFloodAdapter.server";

export type SourceUsed = "seed" | "usgs" | "open-meteo";
export type AdapterName = "earthquake" | "weather-flood";

export interface AdapterOutcome {
  adapter: AdapterName;
  status: "ok" | "error" | "skipped";
  detail: string;
  recordsWritten?: number;
}

export function isLiveDataEnabled(): boolean {
  return String(process.env["LIVE_DATA_ENABLED"] ?? "false").toLowerCase() === "true";
}

export function earthquakeIntervalMs(): number {
  return Number(process.env["POLL_INTERVAL_EARTHQUAKE_MIN"] ?? 5) * 60 * 1000;
}

export function weatherIntervalMs(): number {
  return Number(process.env["POLL_INTERVAL_WEATHER_HOURS"] ?? 3) * 60 * 60 * 1000;
}

/** In-memory debounce so a manual refresh cannot be spammed. */
const MANUAL_DEBOUNCE_MS = 60_000;
const lastManualRun = new Map<string, number>();

export function manualDebounceRemainingMs(key = "all", now = Date.now()): number {
  const last = lastManualRun.get(key);
  if (last === undefined) return 0;
  return Math.max(0, MANUAL_DEBOUNCE_MS - (now - last));
}

export function markManualRun(key = "all", now = Date.now()): void {
  lastManualRun.set(key, now);
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function logSource(
  db: Admin,
  entry: { hazardType: string; sourceUsed: SourceUsed; status: "ok" | "error"; zoneId?: string | null; message?: string | null },
): Promise<void> {
  await db.from("data_source_log").insert({
    hazard_type: entry.hazardType,
    source_used: entry.sourceUsed,
    status: entry.status,
    zone_id: entry.zoneId ?? null,
    message: entry.message ?? null,
  });
}

async function lastOkAt(db: Admin, hazardTypes: string[], sourceUsed: SourceUsed): Promise<number | null> {
  const { data } = await db
    .from("data_source_log")
    .select("fetched_at")
    .in("hazard_type", hazardTypes)
    .eq("source_used", sourceUsed)
    .eq("status", "ok")
    .order("fetched_at", { ascending: false })
    .limit(1);
  const at = data?.[0]?.fetched_at;
  return at ? new Date(at).getTime() : null;
}

/** USGS — every POLL_INTERVAL_EARTHQUAKE_MIN minutes. */
export async function runEarthquakeAdapter(db: Admin, force = false): Promise<AdapterOutcome> {
  const last = await lastOkAt(db, ["earthquake"], "usgs");
  if (!force && last !== null && Date.now() - last < earthquakeIntervalMs()) {
    return { adapter: "earthquake", status: "skipped", detail: "Within the USGS polling interval" };
  }

  try {
    const events = await fetchEarthquakes();
    let written = 0;
    for (const event of events) {
      const { error } = await db
        .from("live_disasters")
        .upsert(toDisasterRow(event), { onConflict: "external_id" });
      if (error) throw error;
      written += 1;
    }
    await logSource(db, {
      hazardType: "earthquake",
      sourceUsed: "usgs",
      status: "ok",
      message: `${written} events upserted`,
    });
    return { adapter: "earthquake", status: "ok", detail: `${written} events upserted`, recordsWritten: written };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown USGS failure";
    // Failure path: log only. Existing rows are left exactly as they were.
    await logSource(db, { hazardType: "earthquake", sourceUsed: "usgs", status: "error", message });
    return { adapter: "earthquake", status: "error", detail: message };
  }
}

/** Open-Meteo — every POLL_INTERVAL_WEATHER_HOURS hours. */
export async function runWeatherFloodAdapter(db: Admin, force = false): Promise<AdapterOutcome> {
  const last = await lastOkAt(db, ["flood", "cyclone", "landslide"], "open-meteo");
  if (!force && last !== null && Date.now() - last < weatherIntervalMs()) {
    return { adapter: "weather-flood", status: "skipped", detail: "Within the Open-Meteo polling interval" };
  }

  const { data: zones, error: zoneError } = await db
    .from("hazard_zones")
    .select(
      "id,name,disaster_type,sample_lat,sample_lng,on_river_channel,river_name,flood_prone,slope_index,soil_saturation",
    );

  if (zoneError || !zones) {
    const message = zoneError?.message ?? "Hazard zones unavailable";
    await logSource(db, { hazardType: "flood", sourceUsed: "open-meteo", status: "error", message });
    return { adapter: "weather-flood", status: "error", detail: message };
  }

  let ok = 0;
  let failed = 0;

  for (const zone of zones as HazardZoneRow[]) {
    try {
      const result = await fetchZoneSignals(zone);

      await db
        .from("hazard_zones")
        .update({
          live_rainfall_mm: result.forecast.rainfallMm,
          live_peak_wind_kmh: result.forecast.peakWindKmh,
          live_min_pressure_hpa: result.forecast.minPressureHpa,
          live_river_discharge_m3s: result.floodSignalValid ? result.flood?.peakDischarge ?? null : null,
          live_landslide_risk: result.landslide,
          live_source: "open-meteo",
          live_updated_at: new Date().toISOString(),
        })
        .eq("id", zone.id);

      if (result.floodError) {
        failed += 1;
        await logSource(db, {
          hazardType: "flood",
          sourceUsed: "open-meteo",
          status: "error",
          zoneId: zone.id,
          message: result.floodError,
        });
      } else {
        ok += 1;
        await logSource(db, {
          hazardType: zone.disaster_type,
          sourceUsed: "open-meteo",
          status: "ok",
          zoneId: zone.id,
          message: `rain ${result.forecast.rainfallMm} mm / peak wind ${result.forecast.peakWindKmh} km/h`,
        });
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown Open-Meteo failure";
      // Zone keeps its last-good values; only the log records the failure.
      await logSource(db, {
        hazardType: zone.disaster_type,
        sourceUsed: "open-meteo",
        status: "error",
        zoneId: zone.id,
        message,
      });
    }
  }

  return {
    adapter: "weather-flood",
    status: failed > 0 && ok === 0 ? "error" : "ok",
    detail: `${ok} zones updated, ${failed} zone failures`,
    recordsWritten: ok,
  };
}

export interface OrchestratorRun {
  liveDataEnabled: boolean;
  ran: boolean;
  reason?: string;
  outcomes: AdapterOutcome[];
}

export async function runOrchestrator(options: { trigger: "cron" | "manual"; force?: boolean } = { trigger: "cron" }): Promise<OrchestratorRun> {
  if (!isLiveDataEnabled()) {
    return { liveDataEnabled: false, ran: false, reason: "LIVE_DATA_ENABLED is false — seeded data untouched", outcomes: [] };
  }

  if (options.trigger === "manual") {
    const remaining = manualDebounceRemainingMs();
    if (remaining > 0) {
      return {
        liveDataEnabled: true,
        ran: false,
        reason: `Manual refresh debounced — retry in ${Math.ceil(remaining / 1000)}s`,
        outcomes: [],
      };
    }
    markManualRun();
  }

  const db = await admin();
  // Independent: one rejection must not cancel the other adapter.
  const [quake, weather] = await Promise.allSettled([
    runEarthquakeAdapter(db, options.force ?? false),
    runWeatherFloodAdapter(db, options.force ?? false),
  ]);

  const outcomes: AdapterOutcome[] = [
    quake.status === "fulfilled"
      ? quake.value
      : { adapter: "earthquake", status: "error", detail: String(quake.reason) },
    weather.status === "fulfilled"
      ? weather.value
      : { adapter: "weather-flood", status: "error", detail: String(weather.reason) },
  ];

  return { liveDataEnabled: true, ran: true, outcomes };
}

export interface SourceStatus {
  hazardType: string;
  sourceUsed: SourceUsed;
  status: "ok" | "error";
  fetchedAt: string;
}

/**
 * Latest state per hazard type. Shape is deliberately source-agnostic so a
 * third or fourth source (GDACS, NDMA SACHET, IMD) can be added later by
 * emitting a new `sourceUsed` value only.
 */
export async function getSourceStatus(): Promise<SourceStatus[]> {
  const db = await admin();
  const { data, error } = await db
    .from("data_source_log")
    .select("hazard_type,source_used,status,fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(400);

  if (error || !data) return [];

  const latest = new Map<string, SourceStatus>();
  for (const row of data) {
    if (latest.has(row.hazard_type)) continue;
    latest.set(row.hazard_type, {
      hazardType: row.hazard_type,
      sourceUsed: row.source_used as SourceUsed,
      status: row.status === "ok" ? "ok" : "error",
      fetchedAt: new Date(row.fetched_at).toISOString(),
    });
  }
  return [...latest.values()];
}
