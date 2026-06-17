import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Page, Screen, Button, Reveal, Money } from "@app/components/ui";
import { getPayment, startPayment, approvePayment, type PaymentView } from "@rail/index";
import { useRailResource, useTicker } from "@app/hooks/useRailResource";

/**
 * 3.2.5 / §4.3 / §4.4 — the "is my money in?" screen. The highest-trust surface. All
 * FIVE UPI outcomes are distinct screens with distinct copy + a specific recovery —
 * never one "payment failed". Updates live from the rail's webhook (the bus), not just
 * polling. The worst case (debited-but-unconfirmed) becomes a calm "money is safe"
 * reconciliation state with an SLA + human escape — never a dead end.
 */
export default function PaymentScreen() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const now = useTicker(1000);
  const [retryId, setRetryId] = useState(paymentId);

  const { data: pay } = useRailResource<PaymentView | undefined>(
    () => (retryId ? getPayment(retryId) : undefined),
    { pollMs: 700, resourceMatch: "payment" },
  );

  // On SUCCESS, advance to the order's units-pending gap.
  useEffect(() => {
    if (pay?.phase === "success" && pay.orderId) {
      const t = setTimeout(() => navigate(`/invest/order/${pay.orderId}`, { replace: true }), 1100);
      return () => clearTimeout(t);
    }
  }, [pay?.phase]); // eslint-disable-line

  function retry() {
    if (!pay) return;
    // Re-issue a fresh collect for the same order (new payment id, new idempotency key).
    const { paymentId: pid } = startPayment({
      orderId: pay.orderId,
      amount: pay.amount,
      idempotencyKey: `pay-retry-${pay.orderId}-${Math.floor(Math.random() * 1e6)}`,
    });
    setRetryId(pid);
  }

  if (!pay) return <Page><Screen title="Payment" /></Page>;

  const secsLeft = Math.max(0, Math.ceil((pay.expiresAt - now) / 1000));
  const mm = Math.floor(secsLeft / 60);
  const ss = String(secsLeft % 60).padStart(2, "0");

  return (
    <Page>
      <Screen title="Pay by UPI" onBack={pay.phase === "pending" ? undefined : "auto"}>
        {/* ── PENDING — awaiting approval in the UPI app ── */}
        {pay.phase === "pending" && (
          <Reveal>
            <div className="flex flex-col items-center pt-6 text-center">
              <div className="breathe grid h-20 w-20 place-items-center rounded-2xl bg-progress-bg text-progress">
                <UpiIcon />
              </div>
              <h1 className="mt-5 font-display text-[21px] font-bold">Approve the {<Money amount={pay.amount} />} request</h1>
              <p className="mt-2 max-w-[300px] text-[14px] text-ink-soft">
                Open your UPI app and approve the request. <span className="font-semibold text-ink">Don’t close this screen</span> — we’re waiting for your bank.
              </p>
              <div className="tnum mt-5 rounded-full border border-progress/25 bg-progress-bg px-4 py-1.5 text-[14px] font-semibold text-progress">
                {mm}:{ss} left
              </div>
            </div>
            <Button block variant="soft" className="mt-7" onClick={() => approvePayment(retryId!)}>
              Open UPI app & approve
            </Button>
            <p className="mt-3 text-center text-[11.5px] text-muted">
              Prototype: tapping “approve” completes the payment. To see the other outcomes, use the dev
              panel (force declined / failed / debited-but-failed) — or just <span className="font-semibold">don’t approve</span> and
              let the timer run out to see EXPIRED.
            </p>
          </Reveal>
        )}

        {/* ── SUCCESS — money received (but units still pending — we say so) ── */}
        {pay.phase === "success" && !pay.debitedButFailed && (
          <Reveal>
            <div className="flex flex-col items-center pt-10 text-center">
              <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 360, damping: 18 }}
                className="grid h-16 w-16 place-items-center rounded-full bg-wait-bg text-wait">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </motion.div>
              <h1 className="mt-5 font-display text-[21px] font-bold text-wait">Payment received</h1>
              <p className="mt-1.5 text-[14px] text-ink-soft">Your money is safely with us. Taking you to your order…</p>
            </div>
          </Reveal>
        )}

        {/* ── EXPIRED — collect timed out ── */}
        {pay.phase === "expired" && (
          <PayOutcome tone="recover" title="The request timed out"
            body="No money was taken — let’s try again." cta="Try again" onCta={retry} />
        )}

        {/* ── REJECTED — user declined ── */}
        {pay.phase === "rejected" && (
          <PayOutcome tone="recover" title="Looks like you declined the request"
            body="No money was taken. Want to try again?" cta="Try again" onCta={retry} secondary="Use a different UPI app" />
        )}

        {/* ── FAILED — generic fail (no money taken) ── */}
        {pay.phase === "failed" && !pay.debitedButFailed && (
          <PayOutcome tone="recover" title="That didn’t go through"
            body="No money was taken. Try another UPI app or method." cta="Try another method" onCta={retry} />
        )}

        {/* ── WORST CASE — debited but unconfirmed (money out, status FAILED) ── */}
        {pay.debitedButFailed && (
          <Reveal>
            <div className="mt-4 rounded-3xl border border-wait/30 bg-wait-bg p-5">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-wait/15 text-wait">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
                </span>
                <h1 className="font-display text-[20px] font-bold text-wait">Your money is safe</h1>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
                We see a debit from your bank but haven’t had final confirmation yet. We’re reconciling
                with your bank. If it isn’t applied to an investment, it’s automatically refunded within
                <span className="font-semibold text-ink"> 5 working days</span>.
              </p>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" variant="soft">Track this</Button>
                <Button className="flex-1" variant="ghost">Talk to our team</Button>
              </div>
            </div>
            <p className="mt-3 text-center text-[11.5px] text-muted">
              We’ll keep you posted by push/email at every step — you never have to keep checking here.
            </p>
            <Button block variant="ghost" className="mt-2" onClick={() => navigate("/home")}>Back to home</Button>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}

function PayOutcome({ tone, title, body, cta, onCta, secondary }: {
  tone: "recover"; title: string; body: string; cta: string; onCta: () => void; secondary?: string;
}) {
  return (
    <Reveal>
      <div className="flex flex-col items-center pt-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-recover-bg text-recover">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 8v5m0 3h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/></svg>
        </div>
        <h1 className="mt-5 font-display text-[21px] font-bold">{title}</h1>
        <p className="mt-2 max-w-[290px] text-[14px] text-ink-soft">{body}</p>
      </div>
      <div className="mt-7 space-y-2">
        <Button block onClick={onCta}>{cta}</Button>
        {secondary && <Button block variant="ghost">{secondary}</Button>}
      </div>
    </Reveal>
  );
}

function UpiIcon() {
  return <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M7 4l5 16 5-16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 9h6M5 13h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
