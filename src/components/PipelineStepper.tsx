import { motion, useReducedMotion } from "framer-motion";
import { PIPELINE_STAGES } from "@/data/mock";

export function PipelineStepper({
  activeIndex,
  running,
  runId,
}: {
  activeIndex: number;
  running: boolean;
  runId: number;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-1">
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
        Pipeline ·{" "}
        <span className="data">
          {running
            ? `stage ${Math.min(activeIndex + 1, PIPELINE_STAGES.length)}/${PIPELINE_STAGES.length}`
            : activeIndex >= PIPELINE_STAGES.length - 1
              ? "complete"
              : "idle"}
        </span>
      </span>
      <ol className="flex min-w-0 flex-1 flex-wrap items-stretch gap-0">
        {PIPELINE_STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const current = i === activeIndex;
          return (
            <motion.li
              key={`${runId}-${stage}`}
              initial={reduced ? false : { opacity: 0.35 }}
              animate={{ opacity: done || current ? 1 : 0.35 }}
              transition={{ duration: 0.25, delay: reduced ? 0 : 0 }}
              className="flex min-w-[96px] flex-1 items-center gap-1.5 border-r border-line px-2 py-1 last:border-r-0"
              style={{
                background: current ? "var(--accent)" : "transparent",
                borderBottom: current ? "2px solid var(--primary)" : "2px solid transparent",
              }}
            >
              <span
                className="data flex h-5 w-5 shrink-0 items-center justify-center text-[11px]"
                style={{
                  background: done ? "var(--brand)" : current ? "var(--primary)" : "transparent",
                  color: done || current ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  border: done || current ? "none" : "1px solid var(--line)",
                }}
              >
                {i + 1}
              </span>
              <span className="text-[12px]" style={{ fontWeight: current ? 700 : 400 }}>
                {stage}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
