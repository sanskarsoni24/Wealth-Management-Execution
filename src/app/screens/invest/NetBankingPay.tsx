import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Page, Screen, Button, Banner, Reveal, Money } from "@app/components/ui";
import { getPayment, approvePayment, abandonPayment, type PaymentView } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";

/**
 * 8.5.2 — Net-banking. Handles the bank redirect honestly, including the common "came
 * back without paying" case, bank page down, and debited-but-unconfirmed (reuses §4.4).
 * On success it advances to the same units-pending gap as UPI.
 */
export default function NetBankingPay() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [bankDown, setBankDown] = useState(false);

  const { data: pay } = useRailResource<PaymentView | undefined>(
    () => (paymentId ? getPayment(paymentId) : undefined),
    { pollMs: 700, resourceMatch: "payment" },
  );

  useEffect(() => {
    if (pay?.phase === "success" && pay.orderId) {
      const t = setTimeout(() => navigate(`/invest/order/${pay.orderId}`, { replace: true }), 1000);
      return () => clearTimeout(t);
    }
  }, [pay?.phase]); // eslint-disable-line

  if (!pay) return <Page><Screen title="Net-banking" /></Page>;

  if (bankDown) {
    return (
      <Page><Screen title="Net-banking" onBack="auto">
        <div className="mt-6"><Banner tone="recover" title="Your bank’s page isn’t responding">
          Try again shortly, or use UPI instead.
        </Banner></div>
        <div className="mt-4 space-y-2">
          <Button block onClick={() => setBankDown(false)}>Try again</Button>
          <Button block variant="ghost" onClick={() => navigate(`/invest/pay-method/${pay.orderId}`)}>Choose another method</Button>
        </div>
      </Screen></Page>
    );
  }

  return (
    <Page>
      <Screen title="Pay via net-banking" onBack={pay.phase === "pending" ? undefined : "auto"}>
        {pay.phase === "pending" && (
          <Reveal>
            <div className="flex flex-col items-center pt-8 text-center">
              <div className="breathe grid h-16 w-16 place-items-center rounded-2xl bg-progress-bg text-progress">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h1 className="mt-5 font-display text-[20px] font-bold">Taking you to your bank to approve <Money amount={pay.amount} /></h1>
              <p className="mt-2 max-w-[300px] text-[14px] text-ink-soft">
                Connecting to your bank… <span className="font-semibold text-ink">don’t close this screen</span>. Complete the payment on your bank’s page, then come back.
              </p>
            </div>
            <div className="mt-7 space-y-2">
              <Button block onClick={() => approvePayment(paymentId!)}>I’ve paid at the bank</Button>
              <Button block variant="ghost" onClick={() => abandonPayment(paymentId!)}>I came back without paying</Button>
              <button onClick={() => setBankDown(true)} className="mt-1 w-full text-center text-[11.5px] text-muted underline">Prototype: simulate bank page down</button>
            </div>
          </Reveal>
        )}

        {pay.phase === "success" && !pay.debitedButFailed && (
          <Reveal>
            <div className="flex flex-col items-center pt-12 text-center">
              <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="grid h-16 w-16 place-items-center rounded-full bg-wait-bg text-wait">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </motion.div>
              <h1 className="mt-5 font-display text-[21px] font-bold text-wait">Payment received</h1>
              <p className="mt-1.5 text-[14px] text-ink-soft">Your money is safely with us. Taking you to your order…</p>
            </div>
          </Reveal>
        )}

        {/* Abandoned-and-returned (no money taken) */}
        {pay.phase === "failed" && pay.abandoned && (
          <Reveal>
            <div className="mt-6"><Banner tone="recover" title="Looks like you came back without finishing">
              No money was taken. Want to try again?
            </Banner></div>
            <div className="mt-4 space-y-2">
              <Button block onClick={() => navigate(`/invest/pay-method/${pay.orderId}`)}>Try again</Button>
              <Button block variant="ghost" onClick={() => navigate(`/invest/order/${pay.orderId}`)}>Back to my order</Button>
            </div>
          </Reveal>
        )}

        {/* Forced fail / debited-but-unconfirmed (reuses §4.4 treatment) */}
        {pay.debitedButFailed && (
          <Reveal>
            <div className="mt-4 rounded-3xl border border-wait/30 bg-wait-bg p-5">
              <h1 className="font-display text-[20px] font-bold text-wait">Your money is safe</h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                We see a debit but no final confirmation yet. We’re reconciling with your bank — if it isn’t applied,
                it’s automatically refunded within <span className="font-semibold text-ink">5 working days</span>.
              </p>
              <div className="mt-4 flex gap-2"><Button className="flex-1" variant="soft">Track this</Button><Button className="flex-1" variant="ghost">Talk to our team</Button></div>
            </div>
          </Reveal>
        )}

        {(pay.phase === "failed" && !pay.abandoned && !pay.debitedButFailed) && (
          <Reveal>
            <div className="mt-6"><Banner tone="recover" title="That didn’t go through">
              No money was taken. Try another method.
            </Banner></div>
            <Button block className="mt-4" onClick={() => navigate(`/invest/pay-method/${pay.orderId}`)}>Choose another method</Button>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}
