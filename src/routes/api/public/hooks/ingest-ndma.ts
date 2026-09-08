import { createFileRoute } from "@tanstack/react-router";

import {
  deductionPayload,
  extractLocation,
  fetchFeedXml,
  geocode,
  makeHash,
  matchHazard,
  nearestOperational,
  parseItems,
  severityFor,
  type SupplyItem,
  type WarehouseRow,
} from "@/lib/ndma.server";

async function runIngestion(): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let seen = 0;
  let inserted = 0;

  try {
    const xml = await fetchFeedXml();
    const items = parseItems(xml);

    const { data: warehouseRows, error: whError } = await supabaseAdmin
      .from("warehouses")
      .select("id,name,lat,lng,status,food,water,medicine,shelter,boats,purification_tablets");
    if (whError) throw whError;
    const warehouses = (warehouseRows ?? []) as WarehouseRow[];

    for (const item of items) {
      const haystack = `${item.title} ${item.description}`;
      const hazard = matchHazard(haystack);
      if (!hazard) continue;
      seen += 1;

      const hash = await makeHash(item.pubDate, item.title);
      const { data: existing } = await supabaseAdmin
        .from("live_disasters")
        .select("id")
        .eq("dedupe_hash", hash)
        .maybeSingle();
      if (existing) continue;

      const { district, state } = extractLocation(item.title);
      const located = await geocode(district, state);
      const severity = severityFor(hazard, haystack);

      const pubDate = item.pubDate ? new Date(item.pubDate) : null;
      const pubIso = pubDate && !Number.isNaN(pubDate.getTime()) ? pubDate.toISOString() : null;

      let dispatchId: string | null = null;
      let distanceKm: number | null = null;
      if (located) {
        const nearest = nearestOperational([located.lat, located.lng], warehouses);
        if (nearest) {
          dispatchId = nearest.warehouse.id;
          distanceKm = nearest.distanceKm;
        }
      }

      const { data: row, error: insertError } = await supabaseAdmin
        .from("live_disasters")
        .insert({
          dedupe_hash: hash,
          title: item.title,
          description: item.description || null,
          pub_date: pubIso,
          hazard_type: hazard,
          district,
          state,
          lat: located?.lat ?? null,
          lng: located?.lng ?? null,
          geocode_source: located?.source ?? "unresolved",
          severity,
          dispatch_warehouse_id: dispatchId,
          dispatch_distance_km: distanceKm,
        })
        .select("id")
        .single();

      if (insertError) {
        // A concurrent run may have written the same alert first.
        console.error("live_disasters insert failed", insertError.message);
        continue;
      }
      inserted += 1;

      if (!dispatchId || !row) continue;
      const target = warehouses.find((w) => w.id === dispatchId);
      if (!target) continue;

      const payload = deductionPayload(hazard, severity);
      const patch: Partial<Record<SupplyItem, number>> = {};
      for (const line of payload) {
        const available = Number(target[line.item] ?? 0);
        const taken = Math.min(available, line.quantity);
        if (taken <= 0) continue;
        patch[line.item] = available - taken;
        target[line.item] = available - taken;
        await supabaseAdmin
          .from("supply_dispatches")
          .insert({ disaster_id: row.id, warehouse_id: dispatchId, item: line.item, quantity: taken });
      }
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin
          .from("warehouses")
          .update({ ...patch, last_updated: new Date().toISOString() })
          .eq("id", dispatchId);
      }
    }

    await supabaseAdmin
      .from("ingestion_runs")
      .insert({ status: "ok", items_seen: seen, items_inserted: inserted });

    return Response.json({ ok: true, itemsSeen: seen, itemsInserted: inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure";
    console.error("NDMA ingestion failed:", message);
    await supabaseAdmin
      .from("ingestion_runs")
      .insert({ status: "failed", items_seen: seen, items_inserted: inserted, error: message });
    return Response.json({ ok: false, error: message, itemsSeen: seen, itemsInserted: inserted }, { status: 502 });
  }
}

export const Route = createFileRoute("/api/public/hooks/ingest-ndma")({
  server: {
    handlers: {
      POST: async () => runIngestion(),
      GET: async () => runIngestion(),
    },
  },
});
