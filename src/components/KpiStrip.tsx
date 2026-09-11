import { useEffect, useRef, useState } from "react";
import { fmt } from "@/data/mock";
import type { Kpi } from "@/components/KpiRail";

/** Counts up once when the value changes — not on scroll or re-render. */
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const initial = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(initial + (target - initial) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

const TONE: Record<string, string> = {
  primary: "var(--primary)",
  brand: "var(--brand)",
  extreme: "var(--sev-extreme)",
  moderate: "var(--sev-moderate)",
};

function Tile({ kpi }: { kpi: Kpi }) {
  const value = useCountUp(kpi.value);
  return (
    <div className="min-w-0 flex-1 border-r border-line px-4 py-2.5 last:border-r-0">
      <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span
          className="data text-[22px] leading-none font-semibold"
          style={{ color: TONE[kpi.tone ?? "brand"] }}
        >
          {fmt(value)}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">{kpi.note}</span>
      </div>
    </div>
  );
}

/** Horizontal KPI band — replaces the tall sidebar rail on the dashboard. */
export function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="flex flex-wrap border-b border-line bg-panel">
      {kpis.map((k) => (
        <Tile key={k.label} kpi={k} />
      ))}
    </div>
  );
}
