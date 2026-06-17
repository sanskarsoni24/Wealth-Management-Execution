import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { dev, subscribe, getLog, type TransitionEvent } from "@rail/index";
import { useDevCutoff } from "@app/context/DevCutoff";

/**
 * The demo superpower (hidden behind Ctrl+Shift+D). Lets a presenter force the next
 * outcome of any gate, fast-forward pending resources, jump the NAV cutoff, scrub
 * time, reset to seeded personas, and watch a live log of every rail transition so
 * they can narrate what the rail is "doing". None of this ships to production.
 */
export function DevPanel() {
  const [open, setOpen] = useState(false);
  const { forcePassed, setForcePassed } = useDevCutoff();
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [log, setLog] = useState<TransitionEvent[]>(getLog());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => subscribe(() => setLog([...getLog()])), []);

  const forces = dev.getForces();
  const timing = dev.getTiming();

  return (
    <>
      {/* Floating toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Dev panel (Ctrl+Shift+D)"
        className="fixed bottom-4 right-4 z-50 grid h-11 w-11 place-items-center rounded-full bg-[#0a282a] text-paper shadow-lift ring-1 ring-white/10 transition hover:scale-105 active:scale-95"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 19.3 7.2 16.7l.9-5.4L4.2 7.7l5.4-.8L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-4 right-4 top-4 z-50 flex w-[360px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c2123] text-[#dceae9] shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="font-display text-[15px] font-semibold text-white">Rail Dev Panel</p>
                <p className="text-[10.5px] text-[#7fa3a1]">Simulating the rail · not in production</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-[#8fb0ae] hover:bg-white/5">✕</button>
            </div>

            <div className="scroll-area flex-1 space-y-4 overflow-y-auto p-4 text-[12.5px]">
              {/* Actions */}
              <Section title="Time">
                <Row>
                  <button onClick={() => { dev.fastForward(); rerender(); }} className={btn}>⏭ Fast-forward all pending</button>
                </Row>
                <Row>
                  <span className="text-[#9fc0be]">timeScale</span>
                  <div className="flex gap-1">
                    {[1, 0.25, 0.05].map((s) => (
                      <button key={s} onClick={() => { dev.setTimeScale(s); rerender(); }}
                        className={`rounded-md px-2 py-1 ${timing.timeScale === s ? "bg-saffron text-white" : "bg-white/5"}`}>
                        {s === 1 ? "1×" : s === 0.25 ? "4× fast" : "20× fast"}
                      </button>
                    ))}
                  </div>
                </Row>
              </Section>

              <Section title="Jump NAV cutoff">
                <Row>
                  <div className="flex gap-1">
                    {([["Before", false], ["After", true], ["Real clock", undefined]] as const).map(([lbl, v]) => (
                      <button key={lbl} onClick={() => setForcePassed(v)}
                        className={`rounded-md px-2.5 py-1 ${forcePassed === v ? "bg-saffron text-white" : "bg-white/5"}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </Row>
                <p className="text-[11px] text-[#7fa3a1]">Flips the countdown + the priced NAV date between today and next market day.</p>
              </Section>

              <Section title="Force next outcome">
                <ForceRow label="Mandate (auto-pay approval)" current={forces.mandate} options={["APPROVED","REJECTED","UNSUPPORTED_BANK"]}
                  onPick={(v) => { dev.forceNext({ mandate: v as any }); rerender(); }} />
                <ForceRow label="Payment (resolves the live request)" current={forces.payment} options={["SUCCESS","FAILED","EXPIRED","REJECTED","DEBITED_BUT_FAILED"]}
                  onPick={(v) => { dev.forcePayment(v as any); rerender(); }} />
                <ForceRow label="Order / Switch buy-leg" current={forces.order} options={["ALLOTTED","REJECTED"]}
                  onPick={(v) => { dev.forceNext({ order: v as any }); rerender(); }} />
                <Row><button onClick={() => { dev.clearForces(); rerender(); }} className={btn}>Clear forced outcomes</button></Row>
              </Section>

              <Section title="Reset">
                <Row><button onClick={() => { dev.resetAll(); setForcePassed(undefined); rerender(); }} className={`${btn} !bg-recover/80 text-white`}>↺ Reset to seeded state</button></Row>
              </Section>

              <Section title="Live transition log">
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-black/20 p-2 font-mono text-[10.5px]">
                  {log.length === 0 && <p className="text-[#6f908e]">No transitions yet…</p>}
                  {log.map((e, i) => (
                    <div key={i} className="flex gap-1.5 leading-tight">
                      <span className="text-[#5f817f]">{new Date(e.at).toLocaleTimeString("en-IN", { hour12: false })}</span>
                      <span className="text-saffron">{e.resource}</span>
                      <span className="text-[#9fc0be]">{e.from}→{e.to}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

const btn = "w-full rounded-lg bg-white/5 px-3 py-2 text-left transition hover:bg-white/10";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-wider text-[#6f908e]">{title}</h3>
      {children}
    </section>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2">{children}</div>;
}
function ForceRow({ label, current, options, onPick }: { label: string; current?: string; options: string[]; onPick: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-[#9fc0be]">{label} {current && <span className="text-saffron">· next: {current}</span>}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o} onClick={() => onPick(o)}
            className={`rounded-md px-2 py-0.5 text-[10.5px] ${current === o ? "bg-saffron text-white" : "bg-white/5 hover:bg-white/10"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
