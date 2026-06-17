import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Banner, Reveal, Money } from "@app/components/ui";
import { getHolding, listFunds, createStp, type FundView } from "@rail/index";
import { useSession } from "@app/context/Session";

/**
 * §4.2 — Move money regularly (STP). An automatic periodic fund→fund transfer. No bank
 * debit (it's fund-to-fund); the source must have enough left, or transfers pause. Error:
 * same fund chosen for both sides.
 */
export default function StpSetup() {
  const { holdingId } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const h = holdingId ? getHolding(holdingId) : undefined;
  const [toSlug, setToSlug] = useState("");
  const [amount, setAmount] = useState("5000");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [day, setDay] = useState(5);

  if (!h || !session) return <Navigate to="/home" replace />;

  const noUnits = h.units <= 0;
  const sameFund = toSlug === h.fundSlug;
  const value = Number(amount);
  const destinations = listFunds({ excludeSlug: h.fundSlug, openOnly: true });
  const valid = !noUnits && !!toSlug && !sameFund && value > 0;

  function create() {
    const { planId } = createStp({
      accountId: session!.accountId, fromFundSlug: h!.fundSlug, toFundSlug: toSlug,
      amount: value, frequency, dayOfMonth: day,
    });
    navigate(`/stp/confirmed/${planId}`, { replace: true });
  }

  return (
    <Page>
      <Screen title="Set up auto-transfer" onBack="auto"
        footer={<Button block disabled={!valid} onClick={create}>Set up transfer</Button>}>
        <Reveal>
          <p className="mt-1 text-[13px] text-muted">From</p>
          <p className="font-display text-[18px] font-semibold">{h.schemeName}</p>
          <p className="tnum text-[13px] text-ink-soft"><Money amount={h.currentValue} /> available</p>
        </Reveal>

        {noUnits ? (
          <Reveal><div className="mt-4"><Banner tone="neutral">You’ll need money in a fund to transfer from first.</Banner></div></Reveal>
        ) : (
          <>
            <Reveal delay={0.06}>
              <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">Into</p>
              <div className="space-y-2">
                {destinations.map((f: FundView) => (
                  <button key={f.slug} onClick={() => setToSlug(f.slug)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${toSlug === f.slug ? "border-ink bg-ink/[0.04]" : "border-line"}`}>
                    <div><p className="text-[14px] font-semibold">{f.name}</p><p className="text-[11.5px] text-muted">{f.category}</p></div>
                    <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${toSlug === f.slug ? "border-ink bg-ink" : "border-line"}`}>{toSlug === f.slug && <span className="h-2 w-2 rounded-full bg-paper" />}</span>
                  </button>
                ))}
              </div>
              {sameFund && <p className="mt-2 text-[12.5px] font-medium text-recover">Pick two different funds to move between.</p>}
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">How much each time</p>
              <div className="flex items-end gap-1 border-b-2 border-line pb-2">
                <span className="font-display text-[24px] font-bold text-ink-soft">₹</span>
                <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
                  className="tnum w-full bg-transparent font-display text-[30px] font-bold outline-none" />
              </div>
              <div className="mt-4 flex gap-2">
                {(["monthly", "weekly"] as const).map((f) => (
                  <button key={f} onClick={() => setFrequency(f)} className={`flex-1 rounded-2xl border py-2.5 text-[13.5px] font-medium capitalize ${frequency === f ? "border-ink bg-ink text-paper" : "border-line text-ink-soft"}`}>{f}</button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[1, 5, 10, 15, 20, 25].map((d) => (
                  <button key={d} onClick={() => setDay(d)} className={`tnum h-10 w-10 rounded-xl border text-[13px] font-semibold ${day === d ? "border-ink bg-ink text-paper" : "border-line text-ink-soft"}`}>{d}</button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-5"><Banner tone="neutral">
                No bank debit — this moves money between your own funds. If {h.schemeName} runs low, transfers pause until you top it up.
              </Banner></div>
            </Reveal>
          </>
        )}
      </Screen>
    </Page>
  );
}
