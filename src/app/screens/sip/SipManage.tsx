import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Card, Banner, Pill, Field, Reveal, Money, formatINR } from "@app/components/ui";
import {
  getSip, pauseSip, resumeSip, cancelSip, stepUpSip, raiseSipCeiling, simulateInstalmentFail, type SipView,
} from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";

/**
 * 3.3.5 — Manage SIP (pause / edit / cancel / step-up). Honest reversibility with
 * truthful can/can't reasons. Step-ups are re-validated against the auto-pay ceiling;
 * a failed instalment is surfaced ("we'll retry, no penalty"), never silent.
 */
export default function SipManage() {
  const { sipId } = useParams();
  const navigate = useNavigate();
  const { data: sip } = useRailResource<SipView | undefined>(
    () => (sipId ? getSip(sipId) : undefined),
    { pollMs: 1000, resourceMatch: "sip" },
  );

  const [mode, setMode] = useState<"none" | "stepup" | "cancel">("none");
  const [newAmount, setNewAmount] = useState("");
  const [exceeds, setExceeds] = useState<{ newAmount: number; ceiling: number } | null>(null);
  const [stepDone, setStepDone] = useState(false);

  if (!sip) {
    // Empty: no SIP here.
    return (
      <Page><Screen title="SIP" onBack="auto">
        <div className="pt-10 text-center">
          <Banner tone="neutral" title="No SIP here">You don’t have any SIPs yet. Automate an investment in under a minute.</Banner>
        </div>
      </Screen></Page>
    );
  }

  const cancelled = sip.phase === "cancelled";
  const paused = sip.phase === "paused";
  const awaiting = sip.phase === "awaiting_mandate";

  function applyStepUp() {
    const amt = Number(newAmount);
    const res = stepUpSip(sip!.sipId, amt);
    if (res.exceedsMandate) { setExceeds(res.exceedsMandate); return; }
    setExceeds(null); setStepDone(true); setMode("none");
  }

  return (
    <Page>
      <Screen title="Manage SIP" onBack="auto">
        <Reveal>
          <Card className="mt-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[15px] font-semibold">{sip.schemeName}</p>
                <p className="tnum mt-0.5 text-[13px] text-ink-soft"><Money amount={sip.amount} /> / month · {sip.dayOfMonth}th</p>
              </div>
              {sip.phase === "active" ? <Pill tone="ok">Live</Pill>
                : awaiting ? <Pill tone="wait">Waiting for bank</Pill>
                : paused ? <Pill tone="neutral">Paused</Pill>
                : <Pill tone="neutral">Cancelled</Pill>}
            </div>
            {sip.phase === "active" && sip.firstDebitDate && (
              <p className="mt-3 border-t border-line pt-3 text-[12.5px] text-ink-soft">
                {sip.startsNextCycle ? "First debit next month" : "Next debit"}: <span className="font-semibold text-ink">{sip.firstDebitDate}</span> · auto-pay limit {formatINR(sip.ceiling)}
              </p>
            )}
          </Card>
        </Reveal>

        {/* Failed instalment (honest, no penalty) */}
        {sip.lastInstalmentFailed && (
          <Reveal>
            <div className="mt-4"><Banner tone="recover" title="Last instalment couldn’t be collected">
              Likely a low balance. We’ll retry on the next working day — no penalty. Top up to avoid a miss.
            </Banner></div>
          </Reveal>
        )}

        {stepDone && (
          <Reveal><div className="mt-4"><Banner tone="wait" title="Done — change applies next cycle">
            Your new amount applies from next month’s instalment.
          </Banner></div></Reveal>
        )}

        {/* Actions */}
        {!cancelled && (
          <Reveal delay={0.08}>
            <div className="mt-5 space-y-2.5">
              {sip.phase === "active" && (
                <ActionRow label="Pause for now" desc="Skip upcoming instalments; resume anytime." onClick={() => pauseSip(sip.sipId)} />
              )}
              {paused && (
                <ActionRow label="Resume SIP" desc="Start instalments again next cycle." onClick={() => resumeSip(sip.sipId)} />
              )}
              <ActionRow label="Increase amount (step-up)" desc="Invest more each month." onClick={() => { setMode("stepup"); setNewAmount(String(sip.amount + 500)); }} />
              <ActionRow label="Cancel SIP" desc="Stop future instalments." danger onClick={() => setMode("cancel")} />
            </div>
          </Reveal>
        )}

        {/* Step-up sheet */}
        {mode === "stepup" && (
          <Reveal>
            <Card className="mt-4">
              <p className="text-[14px] font-semibold">New monthly amount</p>
              <div className="mt-3"><Field inputMode="numeric" prefix="₹" value={newAmount}
                onChange={(e) => { setNewAmount(e.target.value.replace(/\D/g, "").slice(0, 7)); setExceeds(null); }} /></div>
              {exceeds && (
                <div className="mt-3">
                  <Banner tone="recover" title="This step-up would exceed your auto-pay limit">
                    Raising to {formatINR(exceeds.newAmount)} is above your {formatINR(exceeds.ceiling)} limit. Raise the limit to continue.
                  </Banner>
                  <Button block variant="soft" className="mt-2" onClick={() => { raiseSipCeiling(sip.sipId, Number(newAmount) * 2); setExceeds(null); }}>
                    Raise my limit to {formatINR(Number(newAmount) * 2)}
                  </Button>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" variant="ghost" onClick={() => { setMode("none"); setExceeds(null); }}>Back</Button>
                <Button className="flex-1" onClick={applyStepUp}>Apply</Button>
              </div>
            </Card>
          </Reveal>
        )}

        {/* Cancel sheet — truthful can/can't (lock window) */}
        {mode === "cancel" && (
          <Reveal>
            <Card className="mt-4">
              <Banner tone="neutral" title="About cancelling">
                This month’s instalment may already be processing, so it can’t be cancelled today — but you can
                cancel from next cycle onward.
              </Banner>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" variant="ghost" onClick={() => setMode("none")}>Keep my SIP</Button>
                <Button className="flex-1" variant="danger" onClick={() => { cancelSip(sip.sipId); navigate("/home"); }}>Cancel from next cycle</Button>
              </div>
            </Card>
          </Reveal>
        )}

        <Reveal delay={0.2}>
          <button onClick={() => simulateInstalmentFail(sip.sipId, sip.lastInstalmentFailed)}
            className="mt-6 text-[11.5px] text-muted underline">
            Prototype: {sip.lastInstalmentFailed ? "clear" : "simulate"} a failed instalment
          </button>
        </Reveal>
      </Screen>
    </Page>
  );
}

function ActionRow({ label, desc, onClick, danger }: { label: string; desc: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-left transition active:scale-[0.99]">
      <div>
        <p className={`text-[14px] font-semibold ${danger ? "text-recover" : "text-ink"}`}>{label}</p>
        <p className="text-[12px] text-muted">{desc}</p>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}
