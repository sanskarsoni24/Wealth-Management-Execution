import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Banner, Reveal, Money, formatINR } from "@app/components/ui";
import { getHolding, redeemQuote } from "@rail/index";

/**
 * 3.4.2 — Redeem amount (indicative + exit load + lock-in). Tells the truth about what
 * they'll receive and any cost/restriction. The amount is INDICATIVE until the price is
 * struck. Errors: exceeds available; lock-in not over; partial below minimum balance.
 */
export default function RedeemAmount() {
  const { holdingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const all = (location.state as { all?: boolean } | null)?.all ?? false;
  const h = holdingId ? getHolding(holdingId) : undefined;
  const [amount, setAmount] = useState(all && h ? String(h.currentValue) : "");

  if (!h) return <Navigate to="/home" replace />;

  const value = all ? h.currentValue : Number(amount);
  const q = redeemQuote(h.holdingId, { amount: value, allUnits: all });

  let error: string | undefined;
  if (q?.locked) error = `These units are locked until ${q.lockedUntil} (a 3-year rule on this fund) — they can’t be withdrawn yet.`;
  else if (!all && amount && value > h.currentValue) error = `You can withdraw up to ${formatINR(h.currentValue)} from this fund.`;
  else if (!all && amount && h.currentValue - value < q!.minBalance && value < h.currentValue)
    error = `Withdrawing this much would leave less than the ${formatINR(q!.minBalance)} minimum — withdraw all instead?`;

  const valid = !error && (all || (!!amount && value > 0));

  return (
    <Page>
      <Screen title={all ? "Withdraw everything" : "Withdraw"} onBack="auto"
        footer={
          <Button block disabled={!valid}
            onClick={() => navigate(`/redeem/${h.holdingId}/review`, { state: { amount: value, all } })}>
            Continue
          </Button>
        }>
        <Reveal>
          <p className="mt-1 text-[14px] text-ink-soft">{h.schemeName}</p>
          {!all ? (
            <div className="mt-4 flex items-end gap-1 border-b-2 border-line pb-3">
              <span className="font-display text-[28px] font-bold text-ink-soft">₹</span>
              <input autoFocus inputMode="numeric" value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="0" className="tnum w-full bg-transparent font-display text-[38px] font-bold outline-none placeholder:text-line" />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-line bg-card p-4">
              <p className="text-[13px] text-ink-soft">Withdrawing everything</p>
              <p className="tnum font-display text-[26px] font-bold">{<Money amount={h.currentValue} />}</p>
            </div>
          )}
          {!all && (
            <p className="mt-2 text-[12.5px] text-muted">Available: {formatINR(h.currentValue)}</p>
          )}
          {error && <p className="mt-2 text-[13px] font-medium text-recover">{error}</p>}
        </Reveal>

        {valid && q && (
          <Reveal delay={0.08}>
            <div className="mt-5 rounded-3xl border border-line bg-card p-5">
              <Row label="You’ll receive about" value={<Money amount={q.indicativeNet} className="font-bold" />} big />
              {q.exitLoadAmount > 0 && (
                <Row label={`Exit charge (${q.exitLoadPct}%)`} value={<>− <Money amount={q.exitLoadAmount} /></>} />
              )}
              <Row label="Expected in your bank by" value={q.expectedCreditHuman} last />
              <div className="mt-3 rounded-xl bg-wait-bg p-3 text-[12px] text-wait">
                This is indicative — the exact amount is set at the day’s price.
              </div>
            </div>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}

function Row({ label, value, last, big }: { label: string; value: React.ReactNode; last?: boolean; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${last ? "" : "border-b border-line"}`}>
      <span className="text-[13px] text-ink-soft">{label}</span>
      <span className={big ? "text-[18px]" : "text-[14px] font-semibold"}>{value}</span>
    </div>
  );
}
