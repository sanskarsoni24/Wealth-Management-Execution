import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Page, Screen, Button, Card, Banner, Reveal, Money } from "@app/components/ui";
import { OrderTracker } from "@app/components/OrderTracker";
import { getOrder, type OrderView } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";

/**
 * 3.4.4 — Redemption progress + payout. Honest across settlement days: received →
 * processing → paid, with the realised amount once struck. Error: payout bounced
 * (bank account issue) → fix details and we'll resend; money held safely meanwhile.
 */
export default function RedeemProgress() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { data: order } = useRailResource<OrderView | undefined>(
    () => (orderId ? getOrder(orderId) : undefined),
    { pollMs: 800, resourceMatch: "order" },
  );

  if (!order) return <Page><Screen title="Withdrawal" /></Page>;

  const processing = order.phase === "processing";
  const paid = order.phase === "paid_out";
  const bounced = order.phase === "payout_bounced";

  const steps = [
    { label: "Withdrawal received", sub: "We’ve taken your request.", done: true, active: false },
    { label: "Processing", sub: paid ? "Sent to your bank." : `Expected in your bank by ${order.navDate}`, done: paid, active: processing },
    { label: paid ? "Paid to your bank" : "Money in your bank", sub: paid ? `${order.bankLast4 ? "Account ending " + order.bankLast4 : ""}` : "On its way", done: paid, active: false },
  ];

  return (
    <Page>
      <Screen title="Your withdrawal" onBack={paid ? "auto" : undefined}>
        <Reveal>
          <Card className="mt-2">
            <p className="text-[13px] text-muted">{order.schemeName}</p>
            <p className="tnum font-display text-[24px] font-bold">
              {paid && order.realisedAmount ? <Money amount={order.realisedAmount} /> : <Money amount={order.amount} />}
              {!paid && <span className="ml-1 text-[13px] font-normal text-muted">(about)</span>}
            </p>
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-5 rounded-3xl border border-line bg-card p-5">
            <OrderTracker steps={steps} allotted={paid} />
          </div>
        </Reveal>

        {processing && (
          <Reveal delay={0.1}><div className="mt-4"><Banner tone="wait" title="On its way">
            Funds usually arrive in 2–3 working days. We’ll notify you when it lands.
          </Banner></div></Reveal>
        )}

        {paid && (
          <Reveal delay={0.1}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="mt-4 rounded-3xl border border-ok/25 bg-ok-bg p-5 text-center">
              <p className="text-[15px] font-bold text-ok">Paid — {<Money amount={order.realisedAmount ?? order.amount} />} sent</p>
              <p className="mt-1 text-[13px] text-ink-soft">to your bank account{order.bankLast4 ? ` ending ${order.bankLast4}` : ""}.</p>
            </motion.div>
            <Button block variant="ghost" className="mt-4" onClick={() => navigate("/home")}>Back to home</Button>
          </Reveal>
        )}

        {bounced && (
          <Reveal delay={0.1}>
            <div className="mt-4"><Banner tone="recover" title="Your bank returned the payout">
              Confirm your bank details and we’ll resend — your money is safe with us meanwhile.
            </Banner></div>
            <div className="mt-3 space-y-2">
              <Button block variant="soft">Confirm bank details & resend</Button>
              <Button block variant="ghost" onClick={() => navigate("/home")}>Back to home</Button>
            </div>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}
