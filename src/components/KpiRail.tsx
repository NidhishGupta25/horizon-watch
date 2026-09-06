import { useEffect, useRef, useState } from "react";
import { fmt } from "@/data/mock";

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

export interface Kpi {
  label: string;
  value: number;
  note: string;
  tone?: "primary" | "brand" | "extreme" | "moderate";
}

const TONE: Record<string, string> = {
  primary: "var(--primary)",
  brand: "var(--brand)",
  extreme: "var(--sev-extreme)",
  moderate: "var(--sev-moderate)",
};

function KpiTile({ kpi }: { kpi: Kpi }) {
  const value = useCountUp(kpi.value);
  return (
    <div className="border-b border-line px-4 py-3">
      <div className="text-[12px] text-muted-foreground">{kpi.label}</div>
      <div
        className="data mt-1 text-[28px] leading-none font-semibold"
        style={{ color: TONE[kpi.tone ?? "brand"] }}
      >
        {fmt(value)}
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{kpi.note}</div>
    </div>
  );
}

export function KpiRail({ kpis, children }: { kpis: Kpi[]; children?: React.ReactNode }) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-line bg-panel">
      <div className="border-b border-line px-4 py-2.5">
        <h2 className="text-[13px] font-bold">Operational picture</h2>
        <p className="data text-[11px] text-muted-foreground">Window 06 Sep 2026 · 04:00–10:00 IST</p>
      </div>
      {kpis.map((k) => (
        <KpiTile key={k.label} kpi={k} />
      ))}
      {children}
    </aside>
  );
}
