import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const Route = createFileRoute("/api/disasters/live")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const supabase = publicClient();
          const [disasters, warehouses, runs] = await Promise.all([
            supabase
              .from("live_disasters")
              .select(
                "id,title,description,pub_date,hazard_type,district,state,lat,lng,geocode_source,severity,dispatch_warehouse_id,dispatch_distance_km,created_at",
              )
              .order("pub_date", { ascending: false, nullsFirst: false })
              .limit(80),
            supabase
              .from("warehouses")
              .select(
                "id,name,lat,lng,status,capacity,vehicles,food,water,medicine,shelter,boats,purification_tablets,last_updated",
              ),
            supabase
              .from("ingestion_runs")
              .select("ran_at,status,items_seen,items_inserted,error")
              .order("ran_at", { ascending: false })
              .limit(1),
          ]);

          if (disasters.error) throw disasters.error;

          return Response.json(
            {
              disasters: disasters.data ?? [],
              warehouses: warehouses.data ?? [],
              lastRun: runs.data?.[0] ?? null,
            },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (error) {
          console.error("live disasters read failed", error);
          return Response.json(
            { disasters: [], warehouses: [], lastRun: null, error: "Feed unavailable" },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
