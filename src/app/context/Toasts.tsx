import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { subscribe, type TransitionEvent } from "@rail/index";

/**
 * Push/email simulation. The PRD requires that EVERY state change (approved, paid,
 * allotted, refunded, failed) also fires a notification so the user never has to open
 * the app to learn where their money is. We subscribe to the rail bus and surface the
 * user-meaningful transitions as toasts — the in-prototype stand-in for push/email.
 */
interface Toast {
  id: number;
  title: string;
  body: string;
  tone: "ok" | "wait" | "recover" | "progress";
}

const Ctx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

// Map rail transitions -> human push copy. Only meaningful ones notify.
function toastFor(e: TransitionEvent): Omit<Toast, "id"> | null {
  const key = `${e.resource}:${e.to}`;
  switch (key) {
    case "order:ALLOTTED":
      return { title: "Units added ✓", body: "Your investment is complete — you now own units.", tone: "ok" };
    case "order:CONFIRMED":
      return { title: "Payment confirmed", body: "We’re buying your units now.", tone: "progress" };
    case "order:REJECTED":
      return { title: "Order reversed", body: "The fund couldn’t complete it. Your money is being refunded.", tone: "recover" };
    case "order:PAID_OUT":
      return { title: "Withdrawal paid ✓", body: "Money has been sent to your bank.", tone: "ok" };
    case "order:PAYOUT_BOUNCED":
      return { title: "Payout returned", body: "Your bank returned the payout — confirm details to resend.", tone: "recover" };
    case "mandate:APPROVED":
      return { title: "Auto-pay approved ✓", body: "Your SIP is now live.", tone: "ok" };
    case "mandate:REJECTED":
      return { title: "Auto-pay declined", body: "Your bank didn’t approve auto-pay.", tone: "recover" };
    case "payment:SUCCESS":
      return { title: "Money received", body: "Your money is safely with us — units arrive by tomorrow.", tone: "wait" };
    case "payment:FAILED (debited)":
      return { title: "We’re confirming with your bank", body: "Your money is safe. Auto-refund within 5 working days if unapplied.", tone: "wait" };
    default:
      return null;
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(performance.now() % 1000);
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 5200);
  };

  useEffect(() => {
    return subscribe((e) => {
      const t = toastFor(e);
      if (t) push(t);
    });
  }, []);

  const toneBg: Record<Toast["tone"], string> = {
    ok: "border-ok/30 bg-ok-bg",
    wait: "border-wait/30 bg-wait-bg",
    recover: "border-recover/30 bg-recover-bg",
    progress: "border-progress/30 bg-progress-bg",
  };
  const toneText: Record<Toast["tone"], string> = {
    ok: "text-ok", wait: "text-wait", recover: "text-recover", progress: "text-progress",
  };

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      {/* Toasts render at the top of the phone frame */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-center gap-2 px-3 pt-3">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={`pointer-events-auto w-full max-w-[360px] rounded-2xl border ${toneBg[t.tone]} px-4 py-3 shadow-lift backdrop-blur`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 text-base">🔔</span>
                <div className="min-w-0">
                  <p className={`text-[13px] font-bold ${toneText[t.tone]}`}>{t.title}</p>
                  <p className="text-[12px] leading-snug text-ink-soft">{t.body}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">Push · Email</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToasts() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToasts within ToastProvider");
  return v;
}
