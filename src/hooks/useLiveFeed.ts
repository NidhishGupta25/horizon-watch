import { useQuery } from "@tanstack/react-query";

import type { AuditEntry, DisasterType, Severity, Zone } from "@/data/mock";

export interface LiveDisasterRow {
  id: string;
  title: string;
  description: string | null;
  pub_date: string | null;
  hazard_type: string;
  district: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  geocode_source: string;
  severity: Severity;
  dispatch_warehouse_id: string | null;
  dispatch_distance_km: number | null;
  created_at: string;
}

export interface LiveWarehouseRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "operational" | "constrained" | "offline";
  capacity: number;
  vehicles: number;
  food: number;
  water: number;
  medicine: number;
  shelter: number;
  boats: number;
  purification_tablets: number;
  last_updated: string;
}

export interface LiveFeed {
  disasters: LiveDisasterRow[];
  warehouses: LiveWarehouseRow[];
  lastRun: { ran_at: string; status: string; items_seen: number; items_inserted: number; error: string | null } | null;
  error?: string;
}

const HAZARD_MAP: Record<string, DisasterType> = {
  Flood: "flood",
  Cyclone: "cyclone",
  Earthquake: "earthquake",
  Landslide: "landslide",
  Cloudburst: "flood",
  "Heavy Rain": "flood",
};

const SCORE: Record<Severity, number> = { Low: 0.24, Moderate: 0.48, High: 0.72, Extreme: 0.93 };
const AFFECTED: Record<Severity, number> = { Low: 6000, Moderate: 22000, High: 68000, Extreme: 145000 };

export function toZone(row: LiveDisasterRow, warehouses: LiveWarehouseRow[]): Zone | null {
  if (row.lat === null || row.lng === null) return null;
  const type = HAZARD_MAP[row.hazard_type] ?? "flood";
  const severity = (["Low", "Moderate", "High", "Extreme"] as Severity[]).includes(row.severity)
    ? row.severity
    : "Moderate";
  const score = SCORE[severity];
  const affected = AFFECTED[severity];
  const depot = warehouses.find((w) => w.id === row.dispatch_warehouse_id);
  const detectedAt = row.pub_date ?? row.created_at;

  const audit: AuditEntry[] = [
    {
      timestamp: detectedAt,
      action: "Alert received",
      actor: "system",
      decisionSource: "rule-engine",
      details: `NDMA public alert stream — keyword match "${row.hazard_type}".`,
    },
    {
      timestamp: row.created_at,
      action: "Location resolved",
      actor: "system",
      decisionSource: "rule-engine",
      details:
        row.geocode_source === "nominatim"
          ? `Geocoded ${[row.district, row.state].filter(Boolean).join(", ")} to ${row.lat.toFixed(3)}, ${row.lng.toFixed(3)}.`
          : `Geocoding fell back to the ${row.state ?? "state"} capital centroid.`,
    },
  ];
  if (depot && row.dispatch_distance_km !== null) {
    audit.push({
      timestamp: row.created_at,
      action: "Dispatch node flagged",
      actor: "system",
      decisionSource: "DDPI",
      details: `${depot.name} is the closest operational node at ${row.dispatch_distance_km} km (Haversine).`,
    });
  }

  return {
    id: row.id.slice(0, 8).toUpperCase(),
    name: row.district ? `${row.district} alert area` : row.title.slice(0, 46),
    district: [row.district, row.state].filter(Boolean).join(", ") || "Location unresolved",
    type,
    coords: [row.lat, row.lng],
    detectedAt,
    severity,
    score,
    confidence: row.geocode_source === "nominatim" ? 0.86 : 0.62,
    affected,
    ddpi: Math.round(score * 100),
    source: "NDMA public alert stream",
    mode: "LIVE",
    readings: [
      { label: "Hazard keyword", value: row.hazard_type },
      { label: "Latitude", value: row.lat.toFixed(4), unit: "°N" },
      { label: "Longitude", value: row.lng.toFixed(4), unit: "°E" },
      { label: "Location source", value: row.geocode_source },
      ...(row.dispatch_distance_km !== null
        ? [{ label: "Dispatch distance", value: String(row.dispatch_distance_km), unit: "km" }]
        : []),
    ],
    demand: {
      food: Math.round(affected * 0.3),
      water: affected,
      medicine: Math.round(affected * 0.1),
      shelter: Math.round(affected * 0.2),
    },
    insight: depot
      ? `Primary dispatch node is ${depot.name}, ${row.dispatch_distance_km} km away by great-circle distance. Stock has already been reserved against this alert.`
      : "No operational depot could be matched to this alert — resolve the location before allocating.",
    insightSource: "DDPI",
    audit,
  };
}

async function fetchLiveFeed(): Promise<LiveFeed> {
  const res = await fetch("/api/disasters/live", { headers: { Accept: "application/json" } });
  if (!res.ok) return { disasters: [], warehouses: [], lastRun: null, error: `HTTP ${res.status}` };
  return (await res.json()) as LiveFeed;
}

export function useLiveFeed() {
  const query = useQuery({
    queryKey: ["live-feed"],
    queryFn: fetchLiveFeed,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const feed = query.data;
  const warehouses = feed?.warehouses ?? [];
  const liveZones = (feed?.disasters ?? [])
    .map((row) => toZone(row, warehouses))
    .filter((z): z is Zone => z !== null);

  return {
    ...query,
    liveZones,
    warehouses,
    lastRun: feed?.lastRun ?? null,
    degraded: Boolean(feed?.error) || query.isError,
  };
}
