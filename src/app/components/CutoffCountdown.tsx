import { getCutoff } from "@rail/index";
import { useTicker } from "@app/hooks/useRailResource";
import { useDevCutoff } from "@app/context/DevCutoff";

/**
 * The cutoff clock as a real, legible object (PRD §4.1). Calm by default — informs,
 * never coerces. Mild emphasis ONLY in the final minutes. After cutoff (or on a
 * holiday) it flips to an expectation-setter showing the effective NAV date, never a
 * blocker. No "buy now or lose out" framing on a money decision.
 */
export function CutoffCountdown({ variant = "line" }: { variant?: "line" | "card" }) {
  const { forcePassed } = useDevCutoff();
  useTicker(1000);
  const c = getCutoff(forcePassed);

  if (c.cutoffPassed) {
    const onHolidayWord = c.navWeekday; // e.g. "Monday"
    return (
      <Wrap variant={variant} tone="wait">
        <span className="font-semibold">It’s past {c.cutoffLabel}</span> — you’ll get{" "}
        {onHolidayWord}’s price ({c.navDateHuman}, the next market day). You can still invest.
      </Wrap>
    );
  }

  const totalSec = Math.max(0, Math.floor(c.msUntilCutoff / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const finalMinutes = totalSec <= 15 * 60; // mild emphasis only in the last 15 min
  const left = h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;

  return (
    <Wrap variant={variant} tone={finalMinutes ? "urgent" : "calm"}>
      <span className="font-semibold">Invest by {c.cutoffLabel}</span> for today’s price ·{" "}
      <span className={`tnum font-semibold ${finalMinutes ? "text-urgent" : ""}`}>{left} left</span>
    </Wrap>
  );
}

function Wrap({
  children, variant, tone,
}: { children: React.ReactNode; variant: "line" | "card"; tone: "calm" | "urgent" | "wait" }) {
  const toneCls = {
    calm: "text-ink-soft",
    urgent: "text-urgent",
    wait: "text-wait",
  }[tone];
  const dot = { calm: "bg-progress", urgent: "bg-urgent", wait: "bg-wait" }[tone];
  if (variant === "card") {
    const bg = tone === "wait" ? "bg-wait-bg border-wait/20" : tone === "urgent" ? "bg-[#fdf3e3] border-urgent/25" : "bg-progress-bg border-progress/15";
    return (
      <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-[13px] ${bg} ${toneCls}`}>
        <ClockIcon />
        <span>{children}</span>
      </div>
    );
  }
  return (
    <p className={`flex items-center gap-2 text-[12.5px] ${toneCls}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span>{children}</span>
    </p>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
