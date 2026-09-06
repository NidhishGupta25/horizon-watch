import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import type { DisasterType } from "@/data/mock";
import { DISASTER_LABEL } from "@/data/mock";
import type { MapCanvasProps } from "./MapCanvas";

const MapCanvas = lazy(() => import("./MapCanvas"));

const ALL_TYPES: DisasterType[] = ["flood", "cyclone", "earthquake", "landslide"];

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-accent">
      <span className="data text-xs text-muted-foreground">Loading GIS surface…</span>
    </div>
  );
}

export function MapPanel(props: MapCanvasProps) {
  const [showHazard, setShowHazard] = useState(true);
  const [showActive, setShowActive] = useState(true);
  const [types, setTypes] = useState<DisasterType[]>(ALL_TYPES);

  const toggleType = (t: DisasterType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="relative h-full w-full">
      <ClientOnly fallback={<MapSkeleton />}>
        <Suspense fallback={<MapSkeleton />}>
          <MapCanvas {...props} showHazard={showHazard} showActive={showActive} hazardTypes={types} />
        </Suspense>
      </ClientOnly>

      {/* Layer controls — bottom right, in place on the map */}
      <div className="pointer-events-auto absolute bottom-4 right-4 z-[500] w-56 panel">
        <div className="flex hairline-b border-b border-line">
          <button
            onClick={() => setShowHazard((v) => !v)}
            className="flex-1 border-r border-line px-2 py-2 text-left text-xs"
            style={{
              background: showHazard ? "var(--brand)" : "transparent",
              color: showHazard ? "var(--brand-foreground)" : "var(--muted-foreground)",
            }}
          >
            Hazard layer
          </button>
          <button
            onClick={() => setShowActive((v) => !v)}
            className="flex-1 px-2 py-2 text-left text-xs"
            style={{
              background: showActive ? "var(--primary)" : "transparent",
              color: showActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
          >
            Active layer
          </button>
        </div>
        <div className="px-2 py-2">
          <div className="mb-1 text-[11px] text-muted-foreground">Hazard types</div>
          <div className="grid grid-cols-2 gap-1">
            {ALL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className="border border-line px-1.5 py-1 text-left text-[11px]"
                style={{
                  background: types.includes(t) ? "var(--accent)" : "transparent",
                  color: types.includes(t) ? "var(--ink)" : "var(--muted-foreground)",
                }}
              >
                {DISASTER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-[500] panel px-3 py-2">
        <div className="mb-1.5 text-[11px] text-muted-foreground">Severity</div>
        <div className="flex items-center gap-3">
          {(["Low", "Moderate", "High", "Extreme"] as const).map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: `var(--sev-${s.toLowerCase()})` }}
              />
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
