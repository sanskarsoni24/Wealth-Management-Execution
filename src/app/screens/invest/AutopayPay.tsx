import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Page, Screen, Button, Banner, Reveal, Money, formatINR } from "@app/components/ui";
import { getOrder, getPayment, startPayment, approvedMandateFor, type PaymentView } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";
import { useSession } from "@app/context/Session";

/**
 * 8.5.3 — Pay using your auto-pay. Funds a one-time investment with the already-approved
 * auto-pay permission — no app-switch — bounded by its ceiling. The bank debit isn't
 * instant, so we say when it lands. Errors: over ceiling, debit bounces.
 */
export default function AutopayPay() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const started = useRef(false);
  const [paymentId, setPaymentId] = useState<string>();

  const order = orderId ? getOrder(orderId) : undefined;
  const mandate = session ? approvedMandateFor(session.accountId) : null;
  const overCeiling = !!order && !!mandate && order.amount > mandate.ceiling;
  const noMandate = !mandate;

  // Kick off the mandate-funded debit once (unless it's not allowed).
  useEffect(() => {
    if (started.current || !order || overCeiling || noMandate) return;
    started.current = true;
    const { paymentId: pid } = startPayment({
      orderId: orderId!, amount: order.amount, method: "MANDATE",
      idempotencyKey: `autopay-${orderId}-${Math.floor(Math.random() * 1e6)}`,
    });
    setPaymentId(pid);
  }, [order, overCeiling, noMandate, orderId]);

  const { data: pay } = useRailResource<PaymentView | undefined>(
    () => (paymentId ? getPayment(paymentId) : undefined),
    { pollMs: 600, resourceMatch: "payment", enabled: !!paymentId },
  );

  useEffect(() => {
    if (pay?.phase === "success" && pay.orderId) {
      const t = setTimeout(() => navigate(`/invest/order/${pay.orderId}`, { replace: true }), 1000);
      return () => clearTimeout(t);
    }
  }, [pay?.phase]); // eslint-disable-line

  if (!order) return <Page><Screen title="Auto-pay" /></Page>;

  if (noMandate || overCeiling) {
    return (
      <Page><Screen title="Pay using auto-pay" onBack="auto">
        <div className="mt-6"><Banner tone="recover" title={overCeiling ? "Above your auto-pay limit" : "No active auto-pay"}>
          {overCeiling
            ? <>{formatINR(order.amount)} is above your {formatINR(mandate!.ceiling)} auto-pay limit — raise the limit or choose another method.</>
            : "You don’t have an approved auto-pay on this account yet. Use UPI or net-banking."}
        </Banner></div>
        <Button block className="mt-4" onClick={() => navigate(`/invest/pay-method/${orderId}`)}>Choose another method</Button>
      </Screen></Page>
    );
  }

  const failed = pay?.phase === "failed";

  return (
    <Page>
      <Screen title="Pay using auto-pay">
        {!failed ? (
          <Reveal>
            <div className="flex flex-col items-center pt-10 text-center">
              {pay?.phase === "success" ? (
                <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="grid h-16 w-16 place-items-center rounded-full bg-wait-bg text-wait">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </motion.div>
              ) : (
                <div className="breathe grid h-16 w-16 place-items-center rounded-2xl bg-progress-bg text-progress">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v10H4zM4 11h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </div>
              )}
              <h1 className="mt-5 font-display text-[20px] font-bold">
                {pay?.phase === "success" ? "Payment received" : <>Pay <Money amount={order.amount} /> using your auto-pay</>}
              </h1>
              <p className="mt-2 max-w-[300px] text-[14px] text-ink-soft">
                {pay?.phase === "success"
                  ? "Your money is safely with us. Taking you to your order…"
                  : <>Within your {formatINR(mandate!.ceiling)} limit · no app-switch. Your bank is processing this — units follow once the money is in (by {order.navDate}).</>}
              </p>
            </div>
          </Reveal>
        ) : (
          <Reveal>
            <div className="mt-6"><Banner tone="recover" title="Your bank couldn’t complete the debit">
              No money was taken. Try UPI instead.
            </Banner></div>
            <Button block className="mt-4" onClick={() => navigate(`/invest/pay-method/${orderId}`)}>Choose another method</Button>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}
