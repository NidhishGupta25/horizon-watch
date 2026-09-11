import { describe, expect, it, vi, afterEach } from "vitest";

import earthquakeFixture from "./earthquake.fixture.json";
import weatherFixture from "./weather.fixture.json";
import floodFixture from "./flood.fixture.json";
import floodDryFixture from "./flood-dry.fixture.json";

import { buildQueryUrl, parseUsgsGeoJson, severityForMagnitude, toDisasterRow } from "../earthquakeAdapter.server";
import { landslideRisk, parseFlood, parseForecast, MIN_PLAUSIBLE_DISCHARGE } from "../weatherFloodAdapter.server";
import { runEarthquakeAdapter } from "../orchestrator.server";

describe("USGS earthquake adapter", () => {
  it("builds a 24 h India-bbox M3+ query", () => {
    const url = buildQueryUrl(new Date("2026-09-09T10:00:00Z"));
    expect(url).toContain("format=geojson");
    expect(url).toContain("starttime=2026-09-08T10%3A00%3A00.000Z");
    expect(url).toContain("minlatitude=6");
    expect(url).toContain("maxlongitude=98");
    expect(url).toContain("minmagnitude=3");
  });

  it("maps magnitude bands to severity", () => {
    expect(severityForMagnitude(3.4)).toBe("Low");
    expect(severityForMagnitude(4.0)).toBe("Moderate");
    expect(severityForMagnitude(5.5)).toBe("High");
    expect(severityForMagnitude(7.0)).toBe("Extreme");
  });

  it("parses the fixture and skips unusable records", () => {
    const events = parseUsgsGeoJson(earthquakeFixture);
    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({ externalId: "us7000abcd", lat: 33.8, lng: 77.9, severity: "Low" });
    expect(events[3]).toMatchObject({ tsunami: true, severity: "Extreme", usgsAlert: "orange" });
  });

  it("produces an upsertable row keyed on the USGS event id", () => {
    const row = toDisasterRow(parseUsgsGeoJson(earthquakeFixture)[1]!);
    expect(row.external_id).toBe("us7000efgh");
    expect(row.dedupe_hash).toBe("usgs:us7000efgh");
    expect(row.source).toBe("USGS");
    expect(row.hazard_type).toBe("Earthquake");
  });

  it("throws on a malformed payload", () => {
    expect(() => parseUsgsGeoJson({})).toThrow();
  });
});

describe("Open-Meteo weather / flood adapter", () => {
  it("derives rainfall, peak wind and minimum pressure", () => {
    const signal = parseForecast(weatherFixture);
    expect(signal.rainfallMm).toBe(45);
    expect(signal.peakRainfallIntensityMmH).toBe(30);
    expect(signal.peakWindKmh).toBe(96.3);
    expect(signal.minPressureHpa).toBe(987.6);
  });

  it("derives peak and mean river discharge", () => {
    const flood = parseFlood(floodFixture);
    expect(flood.peakDischarge).toBe(1450.9);
    expect(flood.meanDischarge).toBeCloseTo(1121.87, 2);
  });

  it("flags implausibly low discharge rather than 'no flood risk'", () => {
    const flood = parseFlood(floodDryFixture);
    expect(flood.peakDischarge).toBeLessThan(MIN_PLAUSIBLE_DISCHARGE);
  });

  it("computes landslide risk without any network call", () => {
    expect(landslideRisk(30, 0.8, 0.6)).toBeGreaterThan(landslideRisk(5, 0.8, 0.6));
    expect(landslideRisk(0, 0.8, 0.6)).toBe(0);
  });

  it("throws on malformed payloads", () => {
    expect(() => parseForecast({})).toThrow();
    expect(() => parseFlood({})).toThrow();
  });
});

/** Minimal Supabase-shaped stub that records writes. */
function stubDb() {
  const logs: Record<string, unknown>[] = [];
  const writes: Record<string, unknown>[] = [];
  const selectChain = {
    select: () => selectChain,
    in: () => selectChain,
    eq: () => selectChain,
    order: () => selectChain,
    limit: async () => ({ data: [], error: null }),
  };
  const db = {
    from(table: string) {
      return {
        ...selectChain,
        insert: async (row: Record<string, unknown>) => {
          if (table === "data_source_log") logs.push(row);
          return { error: null };
        },
        upsert: async (row: Record<string, unknown>) => {
          writes.push(row);
          return { error: null };
        },
      };
    },
  };
  return { db, logs, writes };
}

describe("orchestrator fallback path", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("logs an error and writes no records when USGS fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network timeout"); }));
    const { db, logs, writes } = stubDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await runEarthquakeAdapter(db as any, true);

    expect(outcome.status).toBe("error");
    expect(writes).toHaveLength(0); // seeded / last-good data untouched
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ hazard_type: "earthquake", source_used: "usgs", status: "error" });
  });
});
