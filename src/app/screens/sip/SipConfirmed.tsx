import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Page, Screen, Button, Banner, Pill, Reveal, Money } from "@app/components/ui";
import { getSip, type SipView } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";

/**
 * 3.3.3 / 3.3.4 — SIP confirmed (auto-pay pending) → SIP active. The #1 fix for silent
 * SIP failure: the user leaves with certainty even though bank approval is async. We
 * persist the pending state, then notify on approval with the exact first-debit date —
 * resolving "this cycle or next?" explicitly. Error: approval ultimately rejected.
 */
export default function SipConfirmed() {
  const { sipId } = useParams();
  const navigate = useNavigate();
  const { data: sip } = useRailResource<SipView | undefined>(
    () => (sipId ? getSip(sipId) : undefined),
    { pollMs: 700, resourceMatch: "sip" },
  );

  if (!sip) return <Page><Screen title="Your SIP" /></Page>;

  const rejected = sip.autopayPhase === "rejected" || sip.autopayPhase === "unsupported";
  const active = sip.phase === "active";

  return (
    <Page>
      <Screen title=""
        footer={<Button block onClick={() => navigate("/home")}>Done</Button>}>
        <div className="flex flex-col items-center pt-8 text-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 360, damping: 18 }}
            className={`grid h-18 w-18 place-items-center rounded-full p-4 ${active ? "bg-ok-bg text-ok" : rejected ? "bg-recover-bg text-recover" : "bg-wait-bg text-wait"}`}>
            {active ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : rejected ? (
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 8v5m0 3h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/></svg>
            ) : (
              <span className="breathe text-[26px]">🎉</span>
            )}
          </motion.div>

          <Reveal delay={0.1}>
            {active ? (
              <>
                <h1 className="mt-5 font-display text-[24px] font-bold tracking-tight">Auto-pay approved — your SIP is live</h1>
                <p className="mt-2 text-[14px] text-ink-soft">
                  {sip.startsNextCycle
                    ? <>Approved after this month’s date — your first debit will be next month, on <span className="font-semibold text-ink">{sip.firstDebitDate}</span>.</>
                    : <>First debit: <span className="font-semibold text-ink">{sip.firstDebitDate}</span>, then the {sip.dayOfMonth}th of every month (or the next working day).</>}
                </p>
              </>
            ) : rejected ? (
              <h1 className="mt-5 font-display text-[23px] font-bold tracking-tight">Auto-pay wasn’t approved</h1>
            ) : (
              <>
                <h1 className="mt-5 font-display text-[26px] font-bold tracking-tight">Your SIP is set 🎉</h1>
                <p className="mt-2 max-w-[310px] text-[14px] text-ink-soft">
                  First instalment starts once your bank approves auto-pay — usually within a day. We’ll text you.
                </p>
              </>
            )}
          </Reveal>
        </div>

        <Reveal delay={0.18}>
          <div className="mt-6 rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-soft">{sip.schemeName}</span>
              <span className="text-[14px] font-semibold"><Money amount={sip.amount} />/mo</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <span className="text-[13px] text-ink-soft">Auto-pay</span>
              {active ? <Pill tone="ok">Approved · Live</Pill>
                : rejected ? <Pill tone="recover">Not approved</Pill>
                : <Pill tone="wait">Waiting for bank approval</Pill>}
            </div>
          </div>
        </Reveal>

        {rejected && (
          <Reveal>
            <div className="mt-4"><Banner tone="recover" title="Your bank didn’t approve auto-pay, so this SIP hasn’t started">
              Retry with another bank, or we can switch it to manual monthly reminders.
            </Banner></div>
            <div className="mt-3 space-y-2">
              <Button block variant="soft">Try another bank</Button>
              <Button block variant="ghost">Switch to manual reminders</Button>
            </div>
          </Reveal>
        )}

        {!active && !rejected && (
          <Reveal delay={0.24}>
            <p className="mt-4 text-center text-[11.5px] text-muted">
              Prototype: approval lands in a few seconds (or fast-forward / force reject in the dev panel).
            </p>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}
