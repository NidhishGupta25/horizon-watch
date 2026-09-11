import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Scheduled trigger for the data-source orchestrator.
 *
 * Public prefix, so the caller is authenticated here with the cron bearer
 * secret. The orchestrator itself enforces the polling cadence, so calling
 * this more often than the interval is a no-op rather than extra API load.
 */
export const Route = createFileRoute("/api/public/hooks/data-sources-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        try {
          const { runOrchestrator } = await import("@/lib/dataSources/orchestrator.server");
          const result = await runOrchestrator({ trigger: "cron" });
          return Response.json(result, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          console.error("scheduled data-source sync failed", error);
          return Response.json({ ran: false, reason: "Sync failed" }, { status: 503 });
        }
      },
    },
  },
});
