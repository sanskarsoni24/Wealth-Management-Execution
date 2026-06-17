import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Page, Screen, Button, Card, Banner, Reveal, Money } from "@app/components/ui";
import { OrderTracker } from "@app/components/OrderTracker";
import { getOrder, type OrderView } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";

/**
 * §4.1 progress — the "in motion" gap named explicitly: sold from A, buying into B, the
 * two legs can land on different days. The reserved success-green appears only when the
 * units are actually in the destination. If the buy leg fails, the amount is returned.
 */
export default function SwitchProgress() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { data: order } = useRailResource<OrderView | undefined>(
    () => (orderId ? getOrder(orderId) : undefined),
    { pollMs: 800, resourceMatch: "order" },
  );

  if (!order) return <Page><Screen title="Your move" /></Page>;

  const inMotion = order.phase === "confirmed";
  const done = order.phase === "allotted";
  const returned = order.phase === "switch_returned";

  const steps = [
    { label: "Move requested", sub: "We’ve taken your instruction.", done: true, active: false },
    { label: `Sold from ${order.schemeName}`, sub: inMotion ? "Money in motion — buying your new fund." : done ? "Done." : "Selling at today’s price…", done: inMotion || done, active: order.phase === "accepted" },
    { label: `Units in ${order.toSchemeName ?? "destination"}`, sub: done ? `${order.units} units at ₹${order.nav?.toFixed(2)}` : `Expected by ${order.navDate}`, done, active: inMotion },
  ];

  return (
    <Page>
      <Screen title="Your move" onBack={done || returned ? "auto" : undefined}>
        <Reveal>
          <Card className="mt-2">
            <p className="text-[13px] text-muted">{order.schemeName} → {order.toSchemeName}</p>
            <p className="tnum font-display text-[22px] font-bold">{<Money amount={order.amount} />}</p>
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-5 rounded-3xl border border-line bg-card p-5">
            <OrderTracker steps={steps} allotted={done} />
          </div>
        </Reveal>

        {inMotion && (
          <Reveal delay={0.1}>
            <div className="mt-4 rounded-3xl border border-wait/25 bg-wait-bg p-5">
              <p className="text-[15px] font-bold text-wait">Your money is moving between funds</p>
              <p className="mt-1.5 text-[13.5px] text-ink-soft">
                Sold from {order.schemeName} at today’s price; units in {order.toSchemeName} expected by {order.navDate}.
              </p>
            </div>
          </Reveal>
        )}

        {returned && (
          <Reveal delay={0.1}>
            <div className="mt-4"><Banner tone="recover" title={`Sold from ${order.schemeName}, but the buy couldn’t complete`}>
              {order.rejectReason} Here’s what happened and what to do next.
            </Banner></div>
            <Button block variant="ghost" className="mt-3" onClick={() => navigate("/home")}>Back to home</Button>
          </Reveal>
        )}

        {done && (
          <Reveal delay={0.1}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="mt-4 rounded-3xl border border-ok/25 bg-ok-bg p-5 text-center">
              <p className="text-[15px] font-bold text-ok">Moved — {order.units} units now in {order.toSchemeName}</p>
            </motion.div>
            <Button block variant="ghost" className="mt-4" onClick={() => navigate("/home")}>See my investments</Button>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}
