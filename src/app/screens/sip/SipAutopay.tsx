import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Field, Banner, Reveal, Money, formatINR } from "@app/components/ui";
import { createMandate, createSip, getFund } from "@rail/index";
import { useSession } from "@app/context/Session";

/**
 * 3.3.2 — Set up auto-pay (the ceiling). The authorised amount is a CEILING, explained
 * in plain terms — "a safety limit, not a charge." The ceiling trap is prevented here:
 * if the SIP amount exceeds the limit, we surface EXCEEDS_MANDATE with a raise-limit
 * affordance rather than letting future debits silently fail.
 */
export default function SipAutopay() {
  const { scheme: slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useSession();
  const st = (location.state as { amount?: number; frequency?: "monthly" | "weekly"; day?: number } | null) ?? {};
  const amount = st.amount ?? 0;
  const s = slug ? getFund(slug) : undefined;

  // Default the ceiling above the SIP amount (headroom for step-ups), explained once.
  const suggested = Math.max(10000, Math.ceil((amount * 2) / 1000) * 1000);
  const [ceiling, setCeiling] = useState(String(suggested));
  const [exceeds, setExceeds] = useState<{ sipAmount: number; ceiling: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!s || !session || !amount) return <Navigate to="/home" replace />;

  const ceilingValue = Number(ceiling);

  function allow() {
    setSubmitting(true);
    setExceeds(null);
    const acc = session!;
    // Register the mandate (async, bank-approved) then create the SIP against it.
    const { mandateId } = createMandate({ accountId: acc.accountId, maxAmount: ceilingValue, ifsc: "HDFC0001234", bankLast4: "9900" });
    const res = createSip({ accountId: acc.accountId, fundSlug: s!.slug, amount, frequency: st.frequency ?? "monthly", dayOfMonth: st.day ?? 5, mandateId });
    setSubmitting(false);
    if (res.exceedsMandate) { setExceeds(res.exceedsMandate); return; }
    if (res.sip) navigate(`/sip/confirmed/${res.sip.sipId}`, { replace: true });
  }

  return (
    <Page>
      <Screen title="Set up auto-pay" onBack="auto"
        footer={<Button block loading={submitting} onClick={allow}>Allow auto-pay up to {<Money amount={ceilingValue || 0} />}</Button>}>
        <Reveal>
          <p className="mt-1 text-[14px] text-ink-soft">
            To run a SIP, your bank needs a one-time auto-pay permission. You approve it once in your bank/UPI app.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-5 rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-soft">Your SIP</span>
              <span className="text-[14px] font-semibold"><Money amount={amount} />/month</span>
            </div>
          </div>
          <div className="mt-4">
            <Field label="Auto-pay limit (a safety ceiling)" inputMode="numeric" prefix="₹" value={ceiling}
              onChange={(e) => { setCeiling(e.target.value.replace(/\D/g, "").slice(0, 8)); setExceeds(null); }} />
          </div>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="mt-3"><Banner tone="neutral">
            This is a safety limit, not a charge — we’ll only ever take your actual SIP amount of{" "}
            <span className="font-semibold">{formatINR(amount)}</span>. The headroom lets you increase your SIP later without re-approving.
          </Banner></div>
        </Reveal>

        {exceeds && (
          <Reveal>
            <div className="mt-3"><Banner tone="recover" title="Your SIP is above your auto-pay limit">
              Your {formatINR(exceeds.sipAmount)} SIP is above your current auto-pay limit of {formatINR(exceeds.ceiling)}.
              Raise your limit to continue.
            </Banner></div>
            <Button block variant="soft" className="mt-2"
              onClick={() => { setCeiling(String(Math.max(suggested, amount * 2))); setExceeds(null); }}>
              Raise my limit
            </Button>
          </Reveal>
        )}

        <Reveal delay={0.2}>
          <p className="mt-4 text-[11.5px] text-muted">
            Prototype: set the limit BELOW your SIP amount and continue to see the “exceeds limit” path.
            The bank approval runs in the background (force approve/reject/unsupported in the dev panel).
          </p>
        </Reveal>
      </Screen>
    </Page>
  );
}
