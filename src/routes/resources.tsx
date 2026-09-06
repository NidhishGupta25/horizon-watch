import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MapPanel } from "@/components/MapPanel";
import { fmt, warehouses, zones } from "@/data/mock";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resource Management — Relief Allocation Console" },
      {
        name: "description",
        content:
          "Warehouse stock, capacity, vehicle availability and shortage tracking across food, water, medicine and shelter supplies.",
      },
      { property: "og:title", content: "Resource Management — Relief Allocation Console" },
      {
        property: "og:description",
        content: "Warehouse inventory, capacity utilisation and demand coverage across the relief network.",
      },
    ],
  }),
  component: Resources,
});

const KINDS = ["food", "water", "medicine", "shelter"] as const;

function Resources() {
  const [selected, setSelected] = useState(warehouses[0]!.id);
  const wh = warehouses.find((w) => w.id === selected)!;

  const totalDemand = KINDS.reduce(
    (acc, k) => ({ ...acc, [k]: zones.reduce((s, z) => s + z.demand[k], 0) }),
    {} as Record<(typeof KINDS)[number], number>,
  );
  const totalStock = KINDS.reduce(
    (acc, k) => ({ ...acc, [k]: warehouses.reduce((s, w) => s + w.inventory[k], 0) }),
    {} as Record<(typeof KINDS)[number], number>,
  );

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-49px)]">
        <aside className="flex w-[420px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel">
          <div className="border-b border-line px-4 py-2.5">
            <h1 className="text-[15px] font-bold">Resource management</h1>
            <p className="data text-[11px] text-muted-foreground">
              5 warehouses · 74 vehicles · stock synced 09:55 IST
            </p>
          </div>

          <div className="border-b border-line px-4 py-3">
            <div className="mb-2 text-[12px] text-muted-foreground">Network stock against live demand</div>
            {KINDS.map((k) => {
              const cover = Math.min(100, Math.round((totalStock[k] / totalDemand[k]) * 100));
              return (
                <div key={k} className="mb-2.5 last:mb-0">
                  <div className="mb-1 flex items-baseline justify-between text-[12px]">
                    <span className="capitalize">{k}</span>
                    <span className="data text-[11px] text-muted-foreground">
                      {fmt(totalStock[k])} / {fmt(totalDemand[k])} · {cover}% covered
                    </span>
                  </div>
                  <div className="h-2.5 border border-line">
                    <div
                      className="h-full"
                      style={{
                        width: `${cover}%`,
                        background: cover < 60 ? "var(--sev-extreme)" : cover < 90 ? "var(--sev-moderate)" : "var(--sev-low)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Warehouse</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 pr-4 text-right font-medium">Vehicles</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => setSelected(w.id)}
                  className="cursor-pointer border-b border-line/60"
                  style={{ background: w.id === selected ? "var(--accent)" : undefined }}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{w.name}</div>
                    <div className="data text-[10.5px] text-muted-foreground">
                      {w.id} · {w.coords[0].toFixed(2)} N, {w.coords[1].toFixed(2)} E
                    </div>
                  </td>
                  <td className="py-2">
                    <span
                      className="inline-block px-1.5 py-0.5 text-[10.5px]"
                      style={{
                        background:
                          w.status === "offline"
                            ? "var(--sev-extreme)"
                            : w.status === "constrained"
                              ? "var(--sev-moderate)"
                              : "var(--brand)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td className="data py-2 pr-4 text-right">{w.vehicles}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-line px-4 py-3">
            <h2 className="text-[13px] font-bold">{wh.name}</h2>
            <div className="data mb-2 text-[11px] text-muted-foreground">
              capacity {fmt(wh.capacity)} · updated{" "}
              {new Date(wh.lastUpdated).toISOString().slice(0, 16).replace("T", " ")} UTC
            </div>
            <table className="w-full text-[12px]">
              <tbody>
                {KINDS.map((k) => (
                  <tr key={k} className="border-b border-line/60 last:border-b-0">
                    <td className="py-1 capitalize">{k}</td>
                    <td className="data py-1 text-right">{fmt(wh.inventory[k])} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <MapPanel showRoutes={false} />
        </div>
      </div>
    </AppShell>
  );
}
