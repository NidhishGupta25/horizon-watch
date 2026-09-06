import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MapPanel } from "@/components/MapPanel";
import { allocations, fmt, zones } from "@/data/mock";

export const Route = createFileRoute("/allocations")({
  head: () => ({
    meta: [
      { title: "Allocation Results — Relief Allocation Console" },
      {
        name: "description",
        content:
          "OR-Tools warehouse-to-zone allocation plans with routes, vehicle assignment, distance, ETA and unmet-demand comparison against baseline dispatch.",
      },
      { property: "og:title", content: "Allocation Results — Relief Allocation Console" },
      {
        property: "og:description",
        content: "Optimised relief plans: warehouse selection, resource split, routing distance and response time.",
      },
    ],
  }),
  component: Allocations,
});

function Allocations() {
  const [selected, setSelected] = useState(allocations[0]!.id);
  const plan = allocations.find((a) => a.id === selected)!;
  const zone = zones.find((z) => z.id === plan.zoneId);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-49px)]">
        <aside className="flex w-[430px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel">
          <div className="border-b border-line px-4 py-2.5">
            <h1 className="text-[15px] font-bold">Allocation results</h1>
            <p className="data text-[11px] text-muted-foreground">
              Solver run 09:41 IST · 4 plans · objective: unmet demand then travel cost
            </p>
          </div>

          <div className="grid grid-cols-3 border-b border-line">
            {[
              { l: "Unmet demand", v: "11%", note: "baseline 26%" },
              { l: "Transport", v: "2,171 km", note: "baseline 2,784 km" },
              { l: "Mean response", v: "152 min", note: "baseline 214 min" },
            ].map((m) => (
              <div key={m.l} className="border-r border-line px-3 py-2.5 last:border-r-0">
                <div className="text-[11px] text-muted-foreground">{m.l}</div>
                <div className="data text-[17px] font-semibold" style={{ color: "var(--brand)" }}>
                  {m.v}
                </div>
                <div className="data text-[10px] text-muted-foreground">{m.note}</div>
              </div>
            ))}
          </div>

          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="py-2 text-right font-medium">Priority</th>
                <th className="py-2 pr-4 text-right font-medium">ETA</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  className="cursor-pointer border-b border-line/60"
                  style={{ background: a.id === selected ? "var(--accent)" : undefined }}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{a.zone}</div>
                    <div className="data text-[10.5px] text-muted-foreground">
                      {a.id} · from {a.warehouse}
                    </div>
                  </td>
                  <td className="data py-2 text-right">{a.priority}</td>
                  <td className="data py-2 pr-4 text-right">{a.etaMin} min</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-line px-4 py-3">
            <h2 className="text-[13px] font-bold">{plan.id}</h2>
            <div className="data mb-3 text-[11px] text-muted-foreground">
              {plan.warehouse} → {plan.zone} · {plan.distanceKm.toFixed(1)} km · {plan.vehicle}
            </div>
            <table className="w-full text-[12px]">
              <tbody>
                {(["food", "water", "medicine", "shelter"] as const).map((k) => {
                  const need = zone?.demand[k] ?? 0;
                  const sent = plan.resources[k];
                  const pct = need ? Math.min(100, Math.round((sent / need) * 100)) : 100;
                  return (
                    <tr key={k} className="border-b border-line/60 last:border-b-0">
                      <td className="py-1.5 capitalize">{k}</td>
                      <td className="data py-1.5 text-right">
                        {fmt(sent)} / {fmt(need)}
                      </td>
                      <td className="w-24 py-1.5 pl-3">
                        <div className="h-2 border border-line">
                          <div
                            className="h-full"
                            style={{
                              width: `${pct}%`,
                              background: pct < 60 ? "var(--sev-extreme)" : pct < 95 ? "var(--sev-moderate)" : "var(--sev-low)",
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <MapPanel selectedZoneId={plan.zoneId} />
        </div>
      </div>
    </AppShell>
  );
}
