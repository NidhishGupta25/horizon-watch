import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MapPanel } from "@/components/MapPanel";
import { PipelineStepper } from "@/components/PipelineStepper";
import {
  DISASTER_LABEL,
  PIPELINE_STAGES,
  fmt,
  severityOf,
  zones,
  type DisasterType,
} from "@/data/mock";

export const Route = createFileRoute("/simulation")({
  head: () => ({
    meta: [
      { title: "Simulation — Relief Allocation Console" },
      {
        name: "description",
        content:
          "Replay historical events or vary parameters to run the full severity, demand, DDPI and OR-Tools allocation pipeline without an active disaster.",
      },
      { property: "og:title", content: "Simulation — Relief Allocation Console" },
      {
        property: "og:description",
        content: "Historical replay and synthetic parameter variation against the same prediction pipeline.",
      },
    ],
  }),
  component: Simulation,
});

const TYPES: DisasterType[] = ["flood", "cyclone", "earthquake", "landslide"];

const DRIVERS: Record<DisasterType, { label: string; unit: string; max: number; weight: number }> = {
  flood: { label: "Rainfall, 24 h", unit: "mm", max: 400, weight: 0.85 },
  cyclone: { label: "Max sustained wind", unit: "km/h", max: 260, weight: 0.9 },
  earthquake: { label: "Magnitude", unit: "Mw", max: 9, weight: 0.95 },
  landslide: { label: "Rainfall, 72 h", unit: "mm", max: 500, weight: 0.8 },
};

function Simulation() {
  const [type, setType] = useState<DisasterType>("flood");
  const [driver, setDriver] = useState(250);
  const [population, setPopulation] = useState(120000);
  const [accessibility, setAccessibility] = useState(0.6);
  const [stage, setStage] = useState(-1);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<null | ReturnType<typeof compute>>(null);

  const cfg = DRIVERS[type];

  function compute() {
    const norm = Math.min(driver / cfg.max, 1);
    const score = Math.min(0.98, norm * cfg.weight * (0.65 + accessibility * 0.4));
    const severity = severityOf(score);
    const affected = Math.round(population * (0.25 + score * 0.6));
    return {
      score,
      severity,
      affected,
      confidence: 0.68 + score * 0.24,
      ddpi: Math.round(score * 62 + (1 - accessibility) * 22 + Math.min(affected / 200000, 1) * 16),
      demand: {
        food: Math.round(affected * 0.3),
        water: affected,
        medicine: Math.round(affected * (type === "earthquake" ? 0.15 : 0.1)),
        shelter: Math.round(affected * (type === "cyclone" ? 0.25 : 0.2)),
      },
      unmet: Math.max(0, Math.round((affected * 0.3 - 38200) / (affected * 0.3)) * 100),
    };
  }

  useEffect(() => {
    if (!running) return;
    if (stage >= PIPELINE_STAGES.length - 1) {
      const t = setTimeout(() => {
        setRunning(false);
        setResult(compute());
      }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStage((s) => s + 1), 480);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, stage]);

  const run = () => {
    setResult(null);
    setRunId((n) => n + 1);
    setStage(0);
    setRunning(true);
  };

  const baseline = useMemo(
    () =>
      result
        ? {
            distance: Math.round(result.affected / 900 + 210),
            unmet: 26,
            responseMin: 214,
          }
        : null,
    [result],
  );

  const simZones = zones.filter((z) => z.type === type);

  return (
    <AppShell>
      <PipelineStepper activeIndex={stage} running={running} runId={runId} />
      <div className="flex h-[calc(100vh-105px)]">
        <aside className="flex w-[340px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel">
          <div className="border-b border-line px-4 py-2.5">
            <h1 className="text-[15px] font-bold">Simulation</h1>
            <p className="text-[11.5px] text-muted-foreground">
              Runs the same pipeline as live mode, so the console stays demonstrable between events.
            </p>
          </div>

          <div className="border-b border-line px-4 py-3">
            <div className="mb-2 text-[12px] text-muted-foreground">Disaster type</div>
            <div className="grid grid-cols-2 gap-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="border border-line px-2 py-1.5 text-left text-[12px]"
                  style={{
                    background: type === t ? "var(--brand)" : "transparent",
                    color: type === t ? "var(--brand-foreground)" : "var(--ink)",
                  }}
                >
                  {DISASTER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-line px-4 py-3">
            <label className="mb-1 flex items-baseline justify-between text-[12px]">
              <span className="text-muted-foreground">{cfg.label}</span>
              <span className="data font-semibold">
                {driver} {cfg.unit}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={cfg.max}
              value={Math.min(driver, cfg.max)}
              onChange={(e) => setDriver(Number(e.target.value))}
              className="w-full accent-[#C1440E]"
            />

            <label className="mb-1 mt-4 flex items-baseline justify-between text-[12px]">
              <span className="text-muted-foreground">Exposed population</span>
              <span className="data font-semibold">{fmt(population)}</span>
            </label>
            <input
              type="range"
              min={5000}
              max={500000}
              step={5000}
              value={population}
              onChange={(e) => setPopulation(Number(e.target.value))}
              className="w-full accent-[#C1440E]"
            />

            <label className="mb-1 mt-4 flex items-baseline justify-between text-[12px]">
              <span className="text-muted-foreground">Access difficulty</span>
              <span className="data font-semibold">{accessibility.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={accessibility}
              onChange={(e) => setAccessibility(Number(e.target.value))}
              className="w-full accent-[#C1440E]"
            />
          </div>

          <div className="border-b border-line px-4 py-3">
            <button
              onClick={run}
              disabled={running}
              className="w-full px-3 py-2 text-[13px] font-semibold disabled:opacity-60"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {running ? "Running simulation…" : "Run simulation"}
            </button>
          </div>

          {result && (
            <div className="px-4 py-3">
              <div className="mb-2 text-[12px] text-muted-foreground">Run output</div>
              <div
                className="mb-3 px-3 py-2"
                style={{
                  background: `var(--sev-${result.severity.toLowerCase()})`,
                  color: "var(--primary-foreground)",
                }}
              >
                <div className="text-[14px] font-bold">{result.severity} severity</div>
                <div className="data text-[11px]">
                  score {result.score.toFixed(2)} · confidence {result.confidence.toFixed(2)} · DDPI{" "}
                  {result.ddpi}
                </div>
              </div>
              <table className="w-full text-[12px]">
                <tbody>
                  <tr className="border-b border-line/60">
                    <td className="py-1">Affected population</td>
                    <td className="data py-1 text-right">{fmt(result.affected)}</td>
                  </tr>
                  {(["food", "water", "medicine", "shelter"] as const).map((k) => (
                    <tr key={k} className="border-b border-line/60">
                      <td className="py-1 capitalize">{k} demand</td>
                      <td className="data py-1 text-right">{fmt(result.demand[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {baseline && (
                <div className="mt-4">
                  <div className="mb-2 text-[12px] text-muted-foreground">
                    Nearest-warehouse baseline vs DDPI + OR-Tools
                  </div>
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-line text-left text-muted-foreground">
                        <th className="py-1 font-medium">Metric</th>
                        <th className="py-1 text-right font-medium">Baseline</th>
                        <th className="py-1 text-right font-medium">Optimised</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-line/60">
                        <td className="py-1">Transport (km)</td>
                        <td className="data py-1 text-right">{fmt(baseline.distance)}</td>
                        <td className="data py-1 text-right" style={{ color: "var(--sev-low)" }}>
                          {fmt(Math.round(baseline.distance * 0.78))}
                        </td>
                      </tr>
                      <tr className="border-b border-line/60">
                        <td className="py-1">Unmet demand</td>
                        <td className="data py-1 text-right">{baseline.unmet}%</td>
                        <td className="data py-1 text-right" style={{ color: "var(--sev-low)" }}>
                          {Math.round(baseline.unmet * 0.42)}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1">Response time (min)</td>
                        <td className="data py-1 text-right">{baseline.responseMin}</td>
                        <td className="data py-1 text-right" style={{ color: "var(--sev-low)" }}>
                          {Math.round(baseline.responseMin * 0.71)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="min-w-0 flex-1">
          <MapPanel zones={simZones} showRoutes={false} />
        </div>
      </div>
    </AppShell>
  );
}
