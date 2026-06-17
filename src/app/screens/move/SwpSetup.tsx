import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Banner, Reveal, Money, formatINR } from "@app/components/ui";
import { getHolding, getAccount, createSwp, swpDepletionYears } from "@rail/index";
import { useSession } from "@app/context/Session";

/**
 * §4.3 — Get paid regularly (SWP). An automatic periodic payout from a fund to the bank.
 * Each payout reduces the holding and can deplete it; the amount is set at the day's
 * price. We surface a plain-language depletion estimate up front.
 */
export default function SwpSetup() {
  const { holdingId } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const h = holdingId ? getHolding(holdingId) : undefined;
  const acc = session ? getAccount(session.accountId) : undefined;
  const [amount, setAmount] = useState("10000");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [day, setDay] = useState(1);

  if (!h || !session) return <Navigate to="/home" replace />;

  const noUnits = h.units <= 0;
  const value = Number(amount);
  const years = swpDepletionYears(h.holdingId, value, frequency);
  const nearlyDepleted = value > 0 && value >= h.currentValue * 0.8;
  const last4 = acc?.bank.last4 ?? "0000";
  const valid = !noUnits && value > 0 && value <= h.currentValue;

  function create() {
    const { planId } = createSwp({
      accountId: session!.accountId, fromFundSlug: h!.fundSlug,
      amount: value, frequency, dayOfMonth: day, bankLast4: last4,
    });
    navigate(`/swp/confirmed/${planId}`, { replace: true });
  }

  return (
    <Page>
      <Screen title="Get paid regularly" onBack="auto"
        footer={<Button block disabled={!valid} onClick={create}>Set up payouts</Button>}>
        <Reveal>
          <p className="mt-1 text-[13px] text-muted">From</p>
          <p className="font-display text-[18px] font-semibold">{h.schemeName}</p>
          <p className="tnum text-[13px] text-ink-soft"><Money amount={h.currentValue} /> available</p>
        </Reveal>

        {noUnits ? (
          <Reveal><div className="mt-4"><Banner tone="neutral">You’ll need an investment to withdraw from first.</Banner></div></Reveal>
        ) : (
          <>
            <Reveal delay={0.06}>
              <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">Pay me each time</p>
              <div className="flex items-end gap-1 border-b-2 border-line pb-2">
                <span className="font-display text-[24px] font-bold text-ink-soft">₹</span>
                <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="tnum w-full bg-transparent font-display text-[30px] font-bold outline-none" />
              </div>
              {value > h.currentValue && <p className="mt-2 text-[12.5px] font-medium text-recover">That’s more than this fund holds ({formatINR(h.currentValue)}).</p>}
              <div className="mt-4 flex gap-2">
                {(["monthly", "weekly"] as const).map((f) => (
                  <button key={f} onClick={() => setFrequency(f)} className={`flex-1 rounded-2xl border py-2.5 text-[13.5px] font-medium capitalize ${frequency === f ? "border-ink bg-ink text-paper" : "border-line text-ink-soft"}`}>{f}</button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 5, 10, 15, 25].map((d) => (
                  <button key={d} onClick={() => setDay(d)} className={`tnum h-10 w-10 rounded-xl border text-[13px] font-semibold ${day === d ? "border-ink bg-ink text-paper" : "border-line text-ink-soft"}`}>{d}</button>
                ))}
              </div>
              <p className="mt-3 text-[12.5px] text-ink-soft">Paid to your bank ending <span className="tnum font-semibold">{last4}</span> on the {day}{day === 1 ? "st" : "th"} of each month.</p>
            </Reveal>

            {valid && (
              <Reveal delay={0.12}>
                <div className="mt-5"><Banner tone={nearlyDepleted ? "recover" : "neutral"} title={nearlyDepleted ? "This fund is nearly used up" : "How long this lasts"}>
                  {nearlyDepleted
                    ? "Your next payout may be the last, or smaller than you asked — the amount is set at the day’s price."
                    : <>At this rate, this fund lasts about <span className="font-semibold">{years} year{years === 1 ? "" : "s"}</span> (varies with the market). Each payout reduces your holding.</>}
                </Banner></div>
              </Reveal>
            )}
          </>
        )}
      </Screen>
    </Page>
  );
}
