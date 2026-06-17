import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Banner, Reveal, Money, formatINR } from "@app/components/ui";
import { getHolding, listFunds, type FundView } from "@rail/index";

/**
 * §4.1 — Move your money to another fund (switch). A one-time A→B move. We're honest
 * that it's a sell + a buy under the hood: exit load / lock-in on the sell side still
 * apply, and the two legs can price on different days.
 */
export default function SwitchPick() {
  const { holdingId } = useParams();
  const navigate = useNavigate();
  const h = holdingId ? getHolding(holdingId) : undefined;
  const [toSlug, setToSlug] = useState<string>("");
  const [all, setAll] = useState(true);
  const [amount, setAmount] = useState("");

  if (!h) return <Navigate to="/home" replace />;

  const locked = !!h.lockedUntilIso && new Date(h.lockedUntilIso) > new Date();
  const noUnits = h.units <= 0;
  const destinations = listFunds({ excludeSlug: h.fundSlug, openOnly: true });
  const value = all ? h.currentValue : Number(amount);
  const valid = !locked && !noUnits && !!toSlug && value > 0 && value <= h.currentValue;

  return (
    <Page>
      <Screen title="Move to another fund" onBack="auto"
        footer={
          <Button block disabled={!valid}
            onClick={() => navigate(`/switch/${holdingId}/review`, { state: { toSlug, amount: value, all } })}>
            Continue
          </Button>
        }>
        <Reveal>
          <p className="mt-1 text-[13px] text-muted">From</p>
          <p className="font-display text-[18px] font-semibold">{h.schemeName}</p>
          <p className="tnum text-[13px] text-ink-soft"><Money amount={h.currentValue} /> · {h.units} units</p>
        </Reveal>

        {locked && (
          <Reveal><div className="mt-4"><Banner tone="wait" title={`Locked until ${h.lockedUntil}`}>
            These units are locked until {h.lockedUntil} (a 3-year rule) and can’t be moved yet.
          </Banner></div></Reveal>
        )}
        {noUnits && (
          <Reveal><div className="mt-4"><Banner tone="neutral">You don’t have units available to move from this fund yet.</Banner></div></Reveal>
        )}

        {!locked && !noUnits && (
          <>
            <Reveal delay={0.06}>
              <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">Move to</p>
              <div className="space-y-2">
                {destinations.map((f: FundView) => (
                  <button key={f.slug} onClick={() => setToSlug(f.slug)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${toSlug === f.slug ? "border-ink bg-ink/[0.04]" : "border-line"}`}>
                    <div>
                      <p className="text-[14px] font-semibold">{f.name}</p>
                      <p className="text-[11.5px] text-muted">{f.category} · {f.riskWords}</p>
                    </div>
                    <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${toSlug === f.slug ? "border-ink bg-ink" : "border-line"}`}>
                      {toSlug === f.slug && <span className="h-2 w-2 rounded-full bg-paper" />}
                    </span>
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">How much</p>
              <div className="flex gap-2">
                <button onClick={() => setAll(true)} className={`flex-1 rounded-2xl border py-2.5 text-[13.5px] font-medium ${all ? "border-ink bg-ink text-paper" : "border-line text-ink-soft"}`}>Everything</button>
                <button onClick={() => setAll(false)} className={`flex-1 rounded-2xl border py-2.5 text-[13.5px] font-medium ${!all ? "border-ink bg-ink text-paper" : "border-line text-ink-soft"}`}>Part of it</button>
              </div>
              {!all && (
                <div className="mt-3 flex items-end gap-1 border-b-2 border-line pb-2">
                  <span className="font-display text-[24px] font-bold text-ink-soft">₹</span>
                  <input autoFocus inputMode="numeric" value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="0" className="tnum w-full bg-transparent font-display text-[30px] font-bold outline-none placeholder:text-line" />
                </div>
              )}
              {!all && Number(amount) > h.currentValue && (
                <p className="mt-2 text-[12.5px] font-medium text-recover">You can move up to {formatINR(h.currentValue)}.</p>
              )}
            </Reveal>
          </>
        )}
      </Screen>
    </Page>
  );
}
