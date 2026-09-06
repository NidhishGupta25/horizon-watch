import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { DISASTER_LABEL, fmt, type Zone } from "@/data/mock";

const SEV_ORDER = ["Low", "Moderate", "High", "Extreme"] as const;

function PriorityBar({ zone }: { zone: Zone }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] text-muted-foreground">DDPI priority</span>
        <span className="data text-[12px] font-semibold">{zone.ddpi} / 100</span>
      </div>
      <div className="relative h-3 border border-line">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, var(--sev-low) 0%, var(--sev-moderate) 38%, var(--sev-high) 70%, var(--sev-extreme) 100%)",
          }}
        />
        <div
          className="absolute top-[-3px] h-[calc(100%+6px)] w-[2px]"
          style={{ left: `${zone.ddpi}%`, background: "var(--ink)" }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {SEV_ORDER.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function SeverityGauge({ zone }: { zone: Zone }) {
  const pct = Math.round(zone.score * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14">
        <svg viewBox="0 0 40 40" className="h-14 w-14 -rotate-90">
          <circle cx="20" cy="20" r="16" fill="none" stroke="var(--line)" strokeWidth="4" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={`var(--sev-${zone.severity.toLowerCase()})`}
            strokeWidth="4"
            strokeDasharray={`${(pct / 100) * 100.5} 100.5`}
          />
        </svg>
        <span className="data absolute inset-0 flex items-center justify-center text-[12px] font-semibold">
          {pct}
        </span>
      </div>
      <div>
        <div
          className="text-[15px] font-bold"
          style={{ color: `var(--sev-${zone.severity.toLowerCase()})` }}
        >
          {zone.severity} severity
        </div>
        <div className="data text-[11px] text-muted-foreground">
          confidence {zone.confidence.toFixed(2)} · {DISASTER_LABEL[zone.type]} model
        </div>
      </div>
    </div>
  );
}

export function ZoneDetailCard({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const [logOpen, setLogOpen] = useState(false);
  const reduced = useReducedMotion();

  return (
    <motion.section
      key={zone.id}
      initial={reduced ? false : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? undefined : { opacity: 0, x: 16 }}
      transition={{ duration: 0.22 }}
      className="absolute right-4 top-4 z-[600] max-h-[calc(100%-2rem)] w-[360px] overflow-y-auto panel"
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h3 className="text-[15px] font-bold leading-tight">{zone.name}</h3>
          <div className="data text-[11px] text-muted-foreground">
            {zone.id} · {zone.district}
          </div>
          <div className="data text-[11px] text-muted-foreground">
            detected {new Date(zone.detectedAt).toUTCString().slice(5, 22)} UTC · {zone.mode}
          </div>
        </div>
        <button onClick={onClose} className="border border-line px-1.5 text-[13px] hover:bg-accent">
          ×
        </button>
      </div>

      <div className="border-b border-line px-4 py-3">
        <SeverityGauge zone={zone} />
      </div>

      <div className="border-b border-line px-4 py-3">
        <PriorityBar zone={zone} />
      </div>

      <div className="border-b border-line px-4 py-3">
        <div className="mb-2 text-[12px] text-muted-foreground">Live inputs</div>
        <table className="w-full text-[12px]">
          <tbody>
            {zone.readings.map((r) => (
              <tr key={r.label} className="border-b border-line/60 last:border-b-0">
                <td className="py-1 pr-2">{r.label}</td>
                <td className="data py-1 text-right font-medium">
                  {r.value}
                  {r.unit ? ` ${r.unit}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-b border-line px-4 py-3">
        <div className="mb-2 text-[12px] text-muted-foreground">Impact and demand</div>
        <div className="data mb-2 text-[13px]">{fmt(zone.affected)} people affected</div>
        <table className="w-full text-[12px]">
          <tbody>
            {(["food", "water", "medicine", "shelter"] as const).map((k) => (
              <tr key={k} className="border-b border-line/60 last:border-b-0">
                <td className="py-1 capitalize">{k}</td>
                <td className="data py-1 text-right">{fmt(zone.demand[k])} units</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3">
        <div
          className="px-3 py-3"
          style={{ background: "var(--ink)", color: "var(--primary-foreground)" }}
        >
          <div className="text-[11px]" style={{ color: "var(--primary)" }}>
            Recommended action — source: {zone.insightSource}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed">{zone.insight}</p>
        </div>
      </div>

      <div className="border-t border-line">
        <button
          onClick={() => setLogOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-[12px] hover:bg-accent"
        >
          <span>Event / audit log ({zone.audit.length})</span>
          <span className="data">{logOpen ? "−" : "+"}</span>
        </button>
        <AnimatePresence initial={false}>
          {logOpen && (
            <motion.ul
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-line"
            >
              {zone.audit.map((a, i) => (
                <li key={i} className="border-b border-line/60 px-4 py-2 last:border-b-0">
                  <div className="data text-[10.5px] text-muted-foreground">
                    {new Date(a.timestamp).toISOString().slice(0, 19).replace("T", " ")} UTC
                  </div>
                  <div className="text-[12px] font-semibold">{a.action}</div>
                  <div className="text-[11.5px] text-muted-foreground">{a.details}</div>
                  <div className="data mt-0.5 text-[10.5px]" style={{ color: "var(--brand)" }}>
                    actor {a.actor} / source {a.decisionSource}
                  </div>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
