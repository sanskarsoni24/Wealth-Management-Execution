import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

/* ── Page: motion wrapper so route changes cross-fade inside the phone frame ── */
export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -18 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      className="h-full paper-grain"
    >
      {children}
    </motion.div>
  );
}

/* ── Screen scaffold: top app bar + scrollable body + optional pinned footer ── */
export function Screen({
  title,
  onBack,
  children,
  footer,
  progress,
}: {
  title?: string;
  onBack?: (() => void) | "auto";
  children?: ReactNode;
  footer?: ReactNode;
  progress?: { step: number; total: number };
}) {
  const navigate = useNavigate();
  const back = onBack === "auto" ? () => navigate(-1) : onBack;
  return (
    <div className="flex h-full flex-col">
      {(title || back) && (
        <header className="z-10 flex items-center gap-2 px-4 pb-2 pt-4">
          {back && (
            <button
              onClick={back}
              aria-label="Back"
              className="-ml-1 grid h-9 w-9 place-items-center rounded-full text-ink/70 transition hover:bg-ink/5 active:scale-95"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
          {title && <h1 className="font-display text-[17px] font-semibold tracking-tight">{title}</h1>}
        </header>
      )}
      {progress && (
        <div className="px-4 pb-1">
          <div className="flex gap-1.5">
            {Array.from({ length: progress.total }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < progress.step ? "bg-saffron" : "bg-line"}`} />
            ))}
          </div>
        </div>
      )}
      <div className="scroll-area flex-1 overflow-y-auto px-4 pb-4 pt-1">{children}</div>
      {footer && <div className="border-t border-line/70 bg-paper/80 px-4 py-3 backdrop-blur">{footer}</div>}
    </div>
  );
}

/* ── Buttons ── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "danger";
  block?: boolean;
  loading?: boolean;
};
export function Button({ variant = "primary", block, loading, children, className = "", disabled, ...rest }: BtnProps) {
  const base = "relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
  const styles = {
    primary: "bg-ink text-paper shadow-card hover:bg-[#0c2f31]",
    soft: "bg-saffron text-white shadow-card hover:brightness-105",
    ghost: "bg-transparent text-ink hover:bg-ink/5",
    danger: "bg-recover text-white hover:brightness-105",
  }[variant];
  return (
    <button disabled={disabled || loading} className={`${base} ${styles} ${block ? "w-full" : ""} ${className}`} {...rest}>
      {loading && <span className="spin h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />}
      {children}
    </button>
  );
}

/* ── Text input ── */
export function Field({
  label, hint, error, prefix, suffix, ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string; prefix?: string; suffix?: string }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>}
      <div className={`flex items-center rounded-2xl border bg-card px-4 transition focus-within:ring-4 ${
        error ? "border-recover focus-within:ring-recover/15" : "border-line focus-within:border-ink/40 focus-within:ring-ink/10"
      }`}>
        {prefix && <span className="mr-1 text-[15px] font-semibold text-ink-soft">{prefix}</span>}
        <input
          className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-muted/70"
          {...rest}
        />
        {suffix && <span className="ml-1 text-[15px] font-semibold text-ink-soft">{suffix}</span>}
      </div>
      {error ? (
        <span className="mt-1.5 block text-[12.5px] font-medium text-recover">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12.5px] text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

/* ── Card ── */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card p-5 shadow-card ${className}`}>{children}</div>;
}

/* ── Tones for status banners ── */
export type Tone = "ok" | "wait" | "progress" | "recover" | "neutral";
const toneMap: Record<Tone, { bg: string; bd: string; tx: string }> = {
  ok: { bg: "bg-ok-bg", bd: "border-ok/25", tx: "text-ok" },
  wait: { bg: "bg-wait-bg", bd: "border-wait/25", tx: "text-wait" },
  progress: { bg: "bg-progress-bg", bd: "border-progress/25", tx: "text-progress" },
  recover: { bg: "bg-recover-bg", bd: "border-recover/25", tx: "text-recover" },
  neutral: { bg: "bg-ink/[0.03]", bd: "border-line", tx: "text-ink-soft" },
};

export function Banner({ tone = "neutral", title, children, icon }: { tone?: Tone; title?: string; children?: ReactNode; icon?: ReactNode }) {
  const t = toneMap[tone];
  return (
    <div className={`rounded-2xl border ${t.bd} ${t.bg} p-4`}>
      <div className="flex gap-3">
        {icon && <div className={`mt-0.5 ${t.tx}`}>{icon}</div>}
        <div className="min-w-0">
          {title && <p className={`text-[13.5px] font-bold ${t.tx}`}>{title}</p>}
          {children && <div className="text-[13px] leading-relaxed text-ink-soft">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const t = toneMap[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border ${t.bd} ${t.bg} px-2.5 py-1 text-[11.5px] font-semibold ${t.tx}`}>{children}</span>;
}

/* ── Money formatting (Indian grouping, tabular figures) ── */
export function formatINR(n: number, opts: { paise?: boolean } = {}): string {
  const v = opts.paise ? n : Math.round(n);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: opts.paise ? 2 : 0 });
}
export function Money({ amount, paise, className = "" }: { amount: number; paise?: boolean; className?: string }) {
  return <span className={`tnum ${className}`}>{formatINR(amount, { paise })}</span>;
}

/* ── Page-load stagger wrapper ── */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Loading block: a calm, labeled wait — never a bare unlabeled spinner ── */
export function LoadingBlock({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="spin h-8 w-8 rounded-full border-[3px] border-ink/15 border-t-ink" />
      <p className="text-[14px] font-semibold text-ink">{label}</p>
      {sub && <p className="max-w-[260px] text-[12.5px] text-ink-soft">{sub}</p>}
    </div>
  );
}

/* ── A reusable disclaimer line (returns never guaranteed) ── */
export function ReturnsDisclaimer() {
  return (
    <p className="text-[11.5px] leading-snug text-muted">
      Returns aren’t guaranteed — past performance doesn’t predict the future. Mutual fund
      investments are subject to market risks; read all scheme-related documents carefully.
    </p>
  );
}
