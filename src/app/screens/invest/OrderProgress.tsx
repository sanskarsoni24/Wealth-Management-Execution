import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Page, Screen, Button, Card, Banner, Reveal, Money } from "@app/components/ui";
import { OrderTracker } from "@app/components/OrderTracker";
import { getOrder, type OrderView } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";

/**
 * 3.2.4 / 3.2.6 / 3.2.7 — the three truths, the money-in-units-pending gap, and the
 * celebratory allotment. Never one green tick: received → confirmed-with-exchange →
 * (pay) → units allotted. The success-green appears ONLY at allotment.
 */
export default function OrderProgress() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const { data: order } = useRailResource<OrderView | undefined>(
    () => (orderId ? getOrder(orderId) : undefined),
    { pollMs: 800, resourceMatch: "order" },
  );

  if (!order) return <Page><Screen title="Your order" /></Page>;

  const accepted = order.phase === "accepted";
  const confirmed = order.phase === "confirmed";
  const allotted = order.phase === "allotted";
  const rejected = order.phase === "rejected";

  // Three truths
  const steps = [
    { label: "Request received", sub: "We’ve taken your request.", done: true, active: false },
    {
      label: "Confirmed with the exchange",
      sub: accepted ? "Next: pay so we can buy your units." : "Your order is accepted.",
      done: !accepted,
      active: accepted,
    },
    {
      label: "Units in your account",
      sub: allotted ? `${order.units} units at ₹${order.nav?.toFixed(2)}` : confirmed ? "Buying your units…" : "Priced at " + order.navDate,
      done: allotted,
      active: confirmed,
    },
  ];

  function payNow() {
    navigate(`/invest/pay-method/${orderId}`);
  }

  return (
    <Page>
      <Screen title="Your investment" onBack={allotted || accepted ? "auto" : undefined}>
        <Reveal>
          <Card className="mt-2">
            <p className="text-[13px] text-muted">{order.schemeName}</p>
            <p className="tnum font-display text-[24px] font-bold">{<Money amount={order.amount} />}</p>
          </Card>
        </Reveal>

        {/* tracker */}
        <Reveal delay={0.06}>
          <div className="mt-5 rounded-3xl border border-line bg-card p-5">
            <OrderTracker steps={steps} allotted={allotted} />
          </div>
        </Reveal>

        {/* ── ACCEPTED: needs payment ── */}
        {accepted && (
          <Reveal delay={0.12}>
            <div className="mt-4"><Banner tone="progress" title="Accepted — one step left">
              Pay {<Money amount={order.amount} />} and we’ll buy your units at the price for {order.navDate}.
            </Banner></div>
            <Button block className="mt-3" onClick={payNow}>Pay {<Money amount={order.amount} />}</Button>
          </Reveal>
        )}

        {/* ── CONFIRMED: the money-in-units-pending gap (the scariest gap, made calm) ── */}
        {confirmed && (
          <Reveal delay={0.12}>
            <div className="mt-4 rounded-3xl border border-wait/25 bg-wait-bg p-5">
              <p className="text-[15px] font-bold text-wait">Payment received — your money is safely with us.</p>
              <p className="mt-1.5 text-[13.5px] text-ink-soft">
                Your units will be added at today’s price and show in your account by {order.navDate}.
              </p>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-soft">
                <span className="font-semibold text-wait">Received ✓</span>
                <span className="text-line">·</span>
                <span className="breathe font-semibold text-wait">Buying your units…</span>
                <span className="text-line">·</span>
                <span>Expected by {order.navDate}</span>
              </div>
              <p className="mt-3 text-[11.5px] text-muted">We’ll notify you the moment they’re in — you don’t need to keep this open.</p>
            </div>
          </Reveal>
        )}

        {/* ── REJECTED: honest reversal + refund (we said "received", we own it) ── */}
        {rejected && (
          <Reveal delay={0.12}>
            <div className="mt-4"><Banner tone="recover" title="Your order couldn’t be completed by the fund">
              {order.rejectReason} Any money paid is being refunded — expect it in 2–3 working days. Here’s what
              happened and what to do next.
            </Banner></div>
            <Button block variant="ghost" className="mt-3" onClick={() => navigate("/home")}>Back to home</Button>
          </Reveal>
        )}

        {/* ── ALLOTTED: only NOW the celebratory completed state ── */}
        {allotted && (
          <Reveal delay={0.12}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="mt-4 rounded-3xl border border-ok/25 bg-ok-bg p-5 text-center">
              <p className="text-[15px] font-bold text-ok">Done — you now own {order.units} units</p>
              <p className="mt-1 text-[13.5px] text-ink-soft">of {order.schemeName} at ₹{order.nav?.toFixed(2)}.</p>
            </motion.div>
            <div className="mt-4 space-y-2">
              <Button block variant="soft" onClick={() => navigate(`/invest/configure/${order.fundSlug}`)}>
                Make this automatic — set up a monthly SIP
              </Button>
              <Button block variant="ghost" onClick={() => navigate("/home")}>See my investments</Button>
            </div>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}
