import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Card, Banner, Reveal, Money } from "@app/components/ui";
import { getHolding, redeemQuote, placeRedeem, getCutoff } from "@rail/index";
import { useSession } from "@app/context/Session";
import { useDevCutoff } from "@app/context/DevCutoff";

/**
 * 3.4.3 — Review + confirm redemption. The honesty banner stays intact; idempotency
 * lock on submit (never withdraw twice). After cutoff → priced next market day.
 */
export default function RedeemReview() {
  const { holdingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const { forcePassed } = useDevCutoff();
  const st = (location.state as { amount?: number; all?: boolean } | null) ?? {};
  const h = holdingId ? getHolding(holdingId) : undefined;
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(false);
  const idemKey = useRef(`rdm-${holdingId}-${st.amount}-${Math.floor(Math.random() * 1e6)}`).current;

  if (!h || !session) return <Navigate to="/home" replace />;
  const q = redeemQuote(h.holdingId, { amount: st.amount, allUnits: st.all })!;
  const cutoff = getCutoff(forcePassed);

  function confirm() {
    setPlacing(true); setError(false);
    setTimeout(() => {
      try {
        const { orderId } = placeRedeem({
          accountId: session!.accountId, fundSlug: h!.fundSlug,
          amount: q.indicativeNet, allUnits: st.all,
          unitsRedeemed: st.all ? undefined : +(st.amount! / h!.currentValue * h!.units).toFixed(2),
          idempotencyKey: idemKey, cutoffForcePassed: forcePassed,
        });
        navigate(`/redeem/order/${orderId}`, { replace: true });
      } catch { setPlacing(false); setError(true); }
    }, 900);
  }

  return (
    <Page>
      <Screen title="Review withdrawal" onBack={placing ? undefined : "auto"}
        footer={<Button block loading={placing} onClick={confirm}>{placing ? "Placing your withdrawal…" : "Confirm withdrawal"}</Button>}>
        <Reveal>
          <Card className="mt-2">
            <Row label="Fund" value={h.schemeName} />
            <Row label="Withdraw" value={st.all ? "Everything" : <Money amount={st.amount!} />} />
            <Row label="You’ll receive about" value={<Money amount={q.indicativeNet} className="font-bold" />} />
            <Row label="Expected by" value={q.expectedCreditHuman} last />
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-4"><Banner tone="wait">
            This is indicative — the exact amount is set at the day’s price ({cutoff.navDateHuman}).
          </Banner></div>
        </Reveal>

        {cutoff.cutoffPassed && (
          <Reveal><div className="mt-3"><Banner tone="wait" title="Past today’s cutoff">
            It’s past today’s cutoff, so this is priced at the next market day’s value ({cutoff.navDateHuman}). Continue?
          </Banner></div></Reveal>
        )}

        {error && (
          <Reveal><div className="mt-3"><Banner tone="wait" title="We didn’t get a clear confirmation">
            We’re checking and won’t withdraw twice. One moment, then tap Confirm again.
          </Banner></div></Reveal>
        )}
      </Screen>
    </Page>
  );
}

function Row({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${last ? "" : "border-b border-line"}`}>
      <span className="text-[13px] text-ink-soft">{label}</span>
      <span className="text-[14px] font-semibold">{value}</span>
    </div>
  );
}
