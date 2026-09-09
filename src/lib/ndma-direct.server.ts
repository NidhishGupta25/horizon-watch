/**
 * Server-only: read the national alert feed directly (no database),
 * filter by hazard keywords, and normalise into the row shape the
 * dashboard already consumes. Used as a live fallback when the
 * persisted store has no rows yet.
 */
import {
  extractLocation,
  fetchFeedXml,
  geocode,
  makeHash,
  matchHazard,
  nearestOperational,
  parseItems,
  severityFor,
  type WarehouseRow,
} from "@/lib/ndma.server";

export interface DirectAlertRow {
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
  severity: "Low" | "Moderate" | "High" | "Extreme";
  dispatch_warehouse_id: string | null;
  dispatch_distance_km: number | null;
  created_at: string;
}

const MAX_ITEMS = 20;

export async function readFeedDirect(warehouses: WarehouseRow[] = []): Promise<DirectAlertRow[]> {
  const xml = await fetchFeedXml();
  const items = parseItems(xml);
  const now = new Date().toISOString();
  const rows: DirectAlertRow[] = [];

  for (const item of items) {
    if (rows.length >= MAX_ITEMS) break;
    const haystack = `${item.title} ${item.description}`;
    const hazard = matchHazard(haystack);
    if (!hazard) continue;

    const { district, state } = extractLocation(item.title);
    const located = await geocode(district, state);
    const parsedDate = item.pubDate ? new Date(item.pubDate) : null;
    const pubIso =
      parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null;

    let dispatchId: string | null = null;
    let distanceKm: number | null = null;
    if (located) {
      const nearest = nearestOperational([located.lat, located.lng], warehouses);
      if (nearest) {
        dispatchId = nearest.warehouse.id;
        distanceKm = nearest.distanceKm;
      }
    }

    rows.push({
      id: await makeHash(item.pubDate, item.title),
      title: item.title,
      description: item.description || null,
      pub_date: pubIso,
      hazard_type: hazard,
      district,
      state,
      lat: located?.lat ?? null,
      lng: located?.lng ?? null,
      geocode_source: located?.source ?? "unresolved",
      severity: severityFor(hazard, haystack),
      dispatch_warehouse_id: dispatchId,
      dispatch_distance_km: distanceKm,
      created_at: now,
    });
  }

  rows.sort((a, b) => (b.pub_date ?? "").localeCompare(a.pub_date ?? ""));
  return rows;
}
