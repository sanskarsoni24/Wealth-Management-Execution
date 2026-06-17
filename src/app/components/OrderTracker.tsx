import { motion } from "framer-motion";

/**
 * The three truths, never collapsed into one green tick (PRD §4.2):
 *   1. received       — neutral / in-progress
 *   2. accepted       — in-progress, NOT success-green
 *   3. units allotted — the ONLY place the reserved success-green appears
 *
 * `current` is the highest reached step (1-3). `state` distinguishes a node that is
 * actively in progress (breathing) from one that's done.
 */
export type TrackerStep = {
  label: string;
  sub?: string;
  done: boolean;
  active: boolean;
};

export function OrderTracker({ steps, allotted }: { steps: TrackerStep[]; allotted: boolean }) {
  return (
    <ol className="relative ml-1">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const successNode = isLast && allotted; // reserved-green only here
        return (
          <li key={i} className="relative flex gap-3.5 pb-6 last:pb-0">
            {/* connector */}
            {!isLast && (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5 ${
                  steps[i + 1].done || steps[i + 1].active ? "bg-progress/40" : "bg-line"
                }`}
              />
            )}
            {/* node */}
            <span className="relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
              {successNode ? (
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="grid h-6 w-6 place-items-center rounded-full bg-ok text-white"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </motion.span>
              ) : s.done ? (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-progress text-white">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
              ) : s.active ? (
                <span className="breathe grid h-6 w-6 place-items-center rounded-full border-2 border-progress bg-progress-bg">
                  <span className="h-2 w-2 rounded-full bg-progress" />
                </span>
              ) : (
                <span className="h-6 w-6 rounded-full border-2 border-line bg-card" />
              )}
            </span>
            {/* label */}
            <div className="min-w-0 pt-0.5">
              <p className={`text-[14px] font-semibold ${s.done || s.active ? "text-ink" : "text-muted"}`}>
                {s.label}
              </p>
              {s.sub && <p className="mt-0.5 text-[12.5px] text-ink-soft">{s.sub}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
