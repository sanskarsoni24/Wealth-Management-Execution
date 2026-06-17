import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Card, Banner, Reveal, Money } from "@app/components/ui";
import { getHolding, getFund, placeSwitch, getCutoff } from "@rail/index";
import { useSession } from "@app/context/Session";
import { useDevCutoff } from "@app/context/DevCutoff";

/**
 * §4.1 review — honest about the exit charge on the sell side and the two-day timing.
 * Idempotency lock on submit (the move is never placed twice).
 */
export default function SwitchReview() {
  const { holdingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const { forcePassed } = useDevCutoff();
  const st = (location.state as { toSlug?: string; amount?: number; all?: boolean } | null) ?? {};
  const h = holdingId ? getHolding(holdingId) : undefined;
  const to = st.toSlug ? getFund(st.toSlug) : undefined;
  const [placing, setPlacing] = useState(false);
  const idemKey = useRef(`swt-${holdingId}-${st.toSlug}-${st.amount}-${Math.floor(Math.random() * 1e6)}`).current;

  if (!h || !to || !session || !st.amount) return <Navigate to="/home" replace />;

  const exitLoad = Math.round((st.amount * h.exitLoadPct) / 100);
  const net = st.amount - exitLoad;
  const cutoff = getCutoff(forcePassed);

  function move() {
    setPlacing(true);
    setTimeout(() => {
      const { orderId } = placeSwitch({
        accountId: session!.accountId, fromFundSlug: h!.fundSlug, toFundSlug: to!.slug,
        amount: net, allUnits: st.all, idempotencyKey: idemKey, cutoffForcePassed: forcePassed,
      });
      navigate(`/switch/order/${orderId}`, { replace: true });
    }, 900);
  }

  return (
    <Page>
      <Screen title="Review move" onBack={placing ? undefined : "auto"}
        footer={<Button block loading={placing} onClick={move}>{placing ? "Placing your move…" : <>Move {<Money amount={net} />}</>}</Button>}>
        <Reveal>
          <Card className="mt-2">
            <Row label="From" value={h.schemeName} />
            <Row label="To" value={to.name} />
            <Row label="You’ll move about" value={<Money amount={net} className="font-bold" />} />
            {exitLoad > 0 && <Row label={`Exit charge (${h.exitLoadPct}%)`} value={<>− <Money amount={exitLoad} /></>} />}
            <Row label="Units in destination by" value={cutoff.navDateHuman} last />
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-4"><Banner tone="wait" title="Your money will be briefly in motion">
            We sell from {h.schemeName} at {cutoff.navWeekday}’s price, then buy into {to.name}. The two legs can
            price on different days — you’ll see each step.
          </Banner></div>
        </Reveal>

        {cutoff.cutoffPassed && (
          <Reveal><div className="mt-3"><Banner tone="wait" title="Past today’s cutoff">
            It’s past {cutoff.cutoffLabel}, so this prices at the next market day’s value. Continue?
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
