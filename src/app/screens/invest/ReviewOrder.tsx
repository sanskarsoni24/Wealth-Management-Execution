import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Card, Banner, Reveal, Money } from "@app/components/ui";
import { CutoffCountdown } from "@app/components/CutoffCountdown";
import { getFund, placeOrder, getCutoff, getAccount } from "@rail/index";
import { useSession } from "@app/context/Session";
import { useDevCutoff } from "@app/context/DevCutoff";

/**
 * 3.2.3 — Review + confirm (the cutoff object). The live countdown turns a confusing
 * delay into a feature. The Invest button locks on tap and carries a single idempotency
 * key, so double-tap / backgrounding / network drop can NEVER create two orders.
 */
export default function ReviewOrder() {
  const { scheme: slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const { forcePassed } = useDevCutoff();
  const amount = (location.state as { amount?: number } | null)?.amount ?? 0;
  const s = slug ? getFund(slug) : undefined;

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(false);
  // One idempotency key for this whole confirm action — re-tapping reuses it.
  const idemKey = useRef(`ord-${session?.accountId}-${slug}-${amount}-${Math.floor(Math.random() * 1e6)}`).current;

  if (!s || !session || !amount) return <Navigate to="/home" replace />;

  const acc = getAccount(session.accountId);
  const cutoff = getCutoff(forcePassed);

  function invest() {
    setPlacing(true);
    setError(false);
    // Simulate the submit round-trip; idempotent at the rail.
    setTimeout(() => {
      try {
        const { orderId } = placeOrder({
          accountId: session!.accountId,
          fundSlug: s!.slug,
          amount,
          idempotencyKey: idemKey,
          cutoffForcePassed: forcePassed,
        });
        navigate(`/invest/order/${orderId}`, { replace: true });
      } catch {
        setPlacing(false);
        setError(true);
      }
    }, 900);
  }

  return (
    <Page>
      <Screen title="Review" onBack={placing ? undefined : "auto"}
        footer={
          <div className="space-y-2.5">
            <CutoffCountdown variant="card" />
            <Button block loading={placing} onClick={invest}>
              {placing ? "Placing your order… don’t close the app" : <>Invest {<Money amount={amount} />}</>}
            </Button>
          </div>
        }>
        <Reveal>
          <Card className="mt-2">
            <Row label="Fund" value={s.name} />
            <Row label="Amount" value={<Money amount={amount} className="font-bold" />} />
            <Row label="Paying from" value={acc?.bank.bankName ? `${acc.bank.bankName} ···· ${acc.bank.last4}` : "UPI"} last />
          </Card>
        </Reveal>

        {cutoff.cutoffPassed && (
          <Reveal>
            <div className="mt-4"><Banner tone="wait" title="Past today’s cutoff">
              It’s past {cutoff.cutoffLabel}, so you’ll get {cutoff.navWeekday}’s price ({cutoff.navDateHuman}, the
              next market day). Invest anyway?
            </Banner></div>
          </Reveal>
        )}

        {error && (
          <Reveal>
            <div className="mt-4"><Banner tone="wait" title="We didn’t get a clear confirmation">
              We’re checking — we won’t place this twice. One moment, then tap Invest again.
            </Banner></div>
          </Reveal>
        )}

        <Reveal delay={0.1}>
          <p className="mt-4 text-[12px] leading-relaxed text-muted">
            We’ll buy units at the price for {cutoff.navDateHuman}. You’ll see each step — request received,
            confirmed, and units in your account — as it happens.
          </p>
        </Reveal>
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
