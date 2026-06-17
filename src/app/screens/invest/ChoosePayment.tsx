import { useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Reveal, Money, Banner } from "@app/components/ui";
import { getOrder, paymentMethods, startPayment, type OrderView, type PayMethodOption } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";
import { useSession } from "@app/context/Session";

/**
 * 8.5.1 — Choose how to pay (§6.5). UPI default; unavailable methods are shown disabled
 * with a reason, never hidden silently. Card is gated pending compliance. The trust
 * treatment downstream is unchanged — every method resolves through the same states.
 */
export default function ChoosePayment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const idemKey = useRef(`pay-${orderId}-${Math.floor(Math.random() * 1e6)}`).current;

  const { data: order } = useRailResource<OrderView | undefined>(
    () => (orderId ? getOrder(orderId) : undefined),
    { pollMs: 1500 },
  );
  if (!order || !session) return <Page><Screen title="Pay" /></Page>;

  const methods = paymentMethods(session.accountId, order.amount);

  function choose(m: PayMethodOption) {
    if (!m.available) return;
    if (m.method === "MANDATE") { navigate(`/invest/autopay-debit/${orderId}`); return; }
    const { paymentId } = startPayment({ orderId: orderId!, amount: order!.amount, method: m.method, idempotencyKey: `${idemKey}-${m.method}` });
    navigate(m.method === "UPI" ? `/invest/pay/${paymentId}` : `/invest/netbanking/${paymentId}`);
  }

  return (
    <Page>
      <Screen title="How would you like to pay?" onBack="auto">
        <Reveal>
          <p className="mt-1 text-[14px] text-ink-soft">Pay <Money amount={order.amount} className="font-semibold text-ink" /> for {order.schemeName}.</p>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="mt-5 space-y-2.5">
            {methods.map((m) => (
              <button key={m.method} disabled={!m.available} onClick={() => choose(m)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition ${
                  m.available ? "border-line bg-card active:scale-[0.99]" : "border-line bg-ink/[0.02] opacity-70"
                } ${m.method === "UPI" ? "ring-1 ring-saffron/30" : ""}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14.5px] font-semibold">{m.label}</p>
                    {m.method === "UPI" && <span className="rounded-full bg-saffron/15 px-2 py-0.5 text-[10px] font-bold text-saffron-ink">DEFAULT</span>}
                  </div>
                  <p className="text-[12px] text-muted">{m.available ? m.note : m.reason}</p>
                </div>
                {m.available && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted shrink-0"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
            ))}
            {/* Card — gated pending compliance (§6.5 flag) */}
            <div className="flex w-full items-center justify-between rounded-2xl border border-line bg-ink/[0.02] px-4 py-3.5 opacity-70">
              <div><p className="text-[14.5px] font-semibold">Card</p><p className="text-[12px] text-muted">We can’t accept cards for fund purchases. Use UPI or net-banking.</p></div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="mt-5"><Banner tone="neutral">
            Whichever you pick, you’ll see the same honest steps — money received, then units allotted — and we’ll never imply units are yours before they are.
          </Banner></div>
        </Reveal>
      </Screen>
    </Page>
  );
}
