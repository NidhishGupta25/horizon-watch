import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/data-sources/status
 *
 * Returns the latest fetch state per hazard type so the frontend can render a
 * source-attribution badge. `sourceUsed` is an open string set — today
 * "seed" | "usgs" | "open-meteo"; future sources (GDACS, NDMA SACHET, IMD)
 * slot in without changing this response shape.
 *
 * POST triggers a manual refresh (debounced to once per 60 s, and a no-op
 * while LIVE_DATA_ENABLED is false).
 */
export const Route = createFileRoute("/api/data-sources/status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getSourceStatus } = await import("@/lib/dataSources/orchestrator.server");
          return Response.json(await getSourceStatus(), { headers: { "cache-control": "no-store" } });
        } catch (error) {
          console.error("data-source status read failed", error);
          return Response.json([], { status: 503, headers: { "cache-control": "no-store" } });
        }
      },
      POST: async () => {
        try {
          const { runOrchestrator } = await import("@/lib/dataSources/orchestrator.server");
          const result = await runOrchestrator({ trigger: "manual" });
          return Response.json(result, {
            status: result.ran ? 200 : 202,
            headers: { "cache-control": "no-store" },
          });
        } catch (error) {
          console.error("manual data-source refresh failed", error);
          return Response.json({ ran: false, reason: "Refresh failed" }, { status: 503 });
        }
      },
    },
  },
});
