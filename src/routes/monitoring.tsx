import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { MapPanel } from "@/components/MapPanel";
import { ZoneDetailCard } from "@/components/ZoneDetailCard";
import { DISASTER_LABEL, fmt, rainfallSeries, zones } from "@/data/mock";

export const Route = createFileRoute("/monitoring")({
  head: () => ({
    meta: [
      { title: "Disaster Monitoring — Relief Allocation Console" },
      {
        name: "description",
        content:
          "Track detected flood, cyclone, earthquake and landslide events with severity scores, confidence, telemetry trends and feed status.",
      },
      { property: "og:title", content: "Disaster Monitoring — Relief Allocation Console" },
      {
        property: "og:description",
        content: "Detected events, severity confidence and live telemetry trends across monitored zones.",
      },
    ],
  }),
  component: Monitoring,
});

const WINDOWS = ["6h", "24h", "7d"] as const;

function Monitoring() {
  const [selected, setSelected] = useState<string | null>(null);
  const [win, setWin] = useState<(typeof WINDOWS)[number]>("24h");
  const zone = zones.find((z) => z.id === selected);

  return (
    <AppShell>
      <div className="flex h-[calc(100vh-49px)]">
        <aside className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel">
          <div className="border-b border-line px-4 py-2.5">
            <h1 className="text-[15px] font-bold">Disaster monitoring</h1>
            <p className="data text-[11px] text-muted-foreground">
              6 detected events · feeds nominal · last poll 09:58 IST
            </p>
          </div>

          <div className="border-b border-line px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] text-muted-foreground">Rainfall, Kendrapara gauge (mm)</span>
              <div className="flex border border-line">
                {WINDOWS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWin(w)}
                    className="data border-r border-line px-2 py-0.5 text-[11px] last:border-r-0"
                    style={{
                      background: win === w ? "var(--brand)" : "transparent",
                      color: win === w ? "var(--brand-foreground)" : "var(--muted-foreground)",
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rainfallSeries[win]} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="#B9B29B" strokeDasharray="2 3" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#5F6154" }} stroke="#B9B29B" />
                  <YAxis tick={{ fontSize: 10, fill: "#5F6154" }} stroke="#B9B29B" />
                  <RTooltip
                    contentStyle={{
                      background: "#F4F0E4",
                      border: "1px solid #B9B29B",
                      borderRadius: 2,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#1B4B43"
                    strokeWidth={2}
                    fill="#1B4B43"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-left text-muted-foreground">
                <th className="px-4 py-2 font-medium">Zone</th>
                <th className="py-2 font-medium">Severity</th>
                <th className="py-2 pr-4 text-right font-medium">Affected</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr
                  key={z.id}
                  onClick={() => setSelected(z.id)}
                  className="cursor-pointer border-b border-line/60"
                  style={{ background: z.id === selected ? "var(--accent)" : undefined }}
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{z.name}</div>
                    <div className="data text-[10.5px] text-muted-foreground">
                      {z.id} · {DISASTER_LABEL[z.type]}
                    </div>
                  </td>
                  <td className="py-2">
                    <span
                      className="data inline-block px-1.5 py-0.5 text-[10.5px]"
                      style={{
                        background: `var(--sev-${z.severity.toLowerCase()})`,
                        color: "var(--primary-foreground)",
                      }}
                    >
                      {z.severity} {z.score.toFixed(2)}
                    </span>
                  </td>
                  <td className="data py-2 pr-4 text-right">{fmt(z.affected)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-auto border-t border-line px-4 py-3 text-[11.5px] text-muted-foreground">
            Feed status: IMD nominal · CWC nominal · NCS nominal · GSI degraded, last update 08:14 IST.
            Degraded feeds are shown as stale rather than interpolated.
          </div>
        </aside>

        <div className="relative min-w-0 flex-1">
          <MapPanel selectedZoneId={selected} onSelectZone={setSelected} showRoutes={false} />
          <AnimatePresence>
            {zone && <ZoneDetailCard zone={zone} onClose={() => setSelected(null)} />}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}
