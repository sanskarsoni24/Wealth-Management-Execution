import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Reveal, Money, formatINR } from "@app/components/ui";
import { CutoffCountdown } from "@app/components/CutoffCountdown";
import { getFund } from "@rail/index";

/**
 * 3.2.2 — Enter amount. Min/multiple rules + the first appearance of cutoff awareness.
 * Empty: CTA disabled with a hint. Error: below minimum / not a valid multiple.
 */
export default function EnterAmount() {
  const { scheme: slug } = useParams();
  const navigate = useNavigate();
  const s = slug ? getFund(slug) : undefined;
  const [amount, setAmount] = useState("");

  if (!s) return <Navigate to="/home" replace />;

  const value = Number(amount);
  let error: string | undefined;
  if (amount && value < s.minAmount) error = `This fund needs at least ${formatINR(s.minAmount)}`;
  else if (amount && value % s.multiple !== 0) error = `Please enter the amount in multiples of ${formatINR(s.multiple)}`;
  const valid = !!amount && !error;

  const chips = [1000, 5000, 10000].filter((c) => c >= s.minAmount);

  return (
    <Page>
      <Screen title={s.name} onBack="auto"
        footer={
          <div className="space-y-2.5">
            <CutoffCountdown variant="line" />
            <Button block disabled={!valid} onClick={() => navigate(`/invest/review/${slug}`, { state: { amount: value } })}>
              {valid ? <>Invest {<Money amount={value} />}</> : "Enter an amount to continue"}
            </Button>
          </div>
        }>
        <Reveal>
          <p className="mt-2 text-[14px] text-ink-soft">How much would you like to invest?</p>
          <div className="mt-5 flex items-end gap-1 border-b-2 border-line pb-3">
            <span className="font-display text-[30px] font-bold text-ink-soft">₹</span>
            <input
              autoFocus inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="0"
              className="tnum w-full bg-transparent font-display text-[40px] font-bold outline-none placeholder:text-line"
            />
          </div>
          {error ? (
            <p className="mt-2 text-[13px] font-medium text-recover">{error}</p>
          ) : (
            <p className="mt-2 text-[12.5px] text-muted">Minimum for this fund is {formatINR(s.minAmount)}.</p>
          )}
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-5 flex gap-2">
            {chips.map((c) => (
              <button key={c} onClick={() => setAmount(String(c))}
                className="tnum flex-1 rounded-2xl border border-line bg-card py-3 text-[14px] font-semibold text-ink transition active:scale-95">
                {formatINR(c)}
              </button>
            ))}
          </div>
        </Reveal>
      </Screen>
    </Page>
  );
}
