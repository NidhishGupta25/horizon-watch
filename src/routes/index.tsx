import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { KpiRail, type Kpi } from "@/components/KpiRail";
import { MapPanel } from "@/components/MapPanel";
import { PipelineStepper } from "@/components/PipelineStepper";
import { ZoneDetailCard } from "@/components/ZoneDetailCard";
import { useLiveFeed } from "@/hooks/useLiveFeed";
import { PIPELINE_STAGES, fmt, zones } from "@/data/mock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Relief Allocation Console — Live Operations Dashboard" },
      {
        name: "description",
        content:
          "Live GIS command centre for disaster severity prediction, relief demand forecasting, DDPI zone prioritisation and warehouse-to-zone allocation.",
      },
      { property: "og:title", content: "Relief Allocation Console — Live Operations Dashboard" },
      {
        property: "og:description",
        content:
          "Monitor flood, cyclone, earthquake and landslide zones with baseline hazard mapping, demand forecasts and optimised relief routes.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { liveZones, degraded, isLoading } = useLiveFeed();
  const [selected, setSelected] = useState<string | null>(null);
  const [stage, setStage] = useState(PIPELINE_STAGES.length - 1);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);

  const allZones = [...liveZones, ...zones];
  const active = allZones.filter((z) => z.mode === "LIVE");

  useEffect(() => {
    if (selected === null && active.length > 0) setSelected(active[0]!.id);
  }, [selected, active]);

  useEffect(() => {
    if (!running) return;
    if (stage >= PIPELINE_STAGES.length - 1) {
      const done = setTimeout(() => setRunning(false), 700);
      return () => clearTimeout(done);
    }
    const t = setTimeout(() => setStage((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [running, stage]);

  const rerun = () => {
    setRunId((n) => n + 1);
    setStage(0);
    setRunning(true);
  };

  const liveCount = liveZones.length;
  const kpis: Kpi[] = [
    {
      label: "Active disasters",
      value: active.length,
      note: degraded
        ? "Live feed degraded — showing last known events"
        : `${liveCount} from the live national alert feed`,
      tone: "primary",
    },
    {
      label: "High-risk zones",
      value: active.filter((z) => z.score >= 0.6).length,
      note: "Severity High or Extreme by DDPI rank",
      tone: "extreme",
    },
    {
      label: "Affected people",
      value: active.reduce((s, z) => s + z.affected, 0),
      note: "Modelled from population raster and impact layer",
      tone: "brand",
    },
    { label: "Resource shortages", value: 3, note: "Shelter kits, medicine, 8 t vehicles", tone: "moderate" },
  ];

  const zone = allZones.find((z) => z.id === selected);
  const ranked = [...active].sort((a, b) => b.ddpi - a.ddpi);


  return (
    <AppShell>
      <div className="flex h-[calc(100vh-49px)]">
        <aside className="flex w-[272px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel">
          <div className="border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-bold">Priority zones</h2>
            <p className="data text-[11px] text-muted-foreground">
              Window 06 Sep 2026 · 04:00–10:00 IST
            </p>
          </div>
          <div className="border-b border-line px-4 py-3">
            <button
              onClick={rerun}
              disabled={running}
              className="w-full px-3 py-2 text-[13px] font-semibold disabled:opacity-60"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {running ? "Running pipeline…" : "Re-run pipeline"}
            </button>
          </div>
          <div className="px-4 py-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              DDPI priority ranking
            </div>
            <ol>
              {ranked.map((z, i) => (
                <li key={z.id}>
                  <button
                    onClick={() => setSelected(z.id)}
                    className="flex w-full items-center gap-2 border-b border-line/60 py-2 text-left hover:bg-accent"
                    style={{ background: z.id === selected ? "var(--accent)" : undefined }}
                  >
                    <span className="data w-4 text-[11px] text-muted-foreground">{i + 1}</span>
                    <span
                      className="h-6 w-[3px] shrink-0"
                      style={{ background: `var(--sev-${z.severity.toLowerCase()})` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px]">{z.name}</span>
                      <span className="data block text-[10.5px] text-muted-foreground">
                        {fmt(z.affected)} affected
                      </span>
                    </span>
                    <span className="data text-[12px] font-semibold">{z.ddpi}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <KpiStrip kpis={kpis} />
          <PipelineStepper activeIndex={stage} running={running} runId={runId} />
          <div className="relative min-h-0 flex-1">
            <MapPanel zones={allZones} selectedZoneId={selected} onSelectZone={setSelected} />
            <AnimatePresence>
              {zone && <ZoneDetailCard zone={zone} onClose={() => setSelected(null)} />}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
