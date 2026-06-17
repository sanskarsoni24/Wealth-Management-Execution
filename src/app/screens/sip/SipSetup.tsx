import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Reveal, Money, Banner, formatINR } from "@app/components/ui";
import { getFund, previewFirstDebit } from "@rail/index";

/**
 * 3.3.1 — SIP amount, frequency, date. Plain-language dates; a holiday-shifted date is
 * shown with its effective date, never the raw tapped date. Error: below scheme SIP min.
 */
export default function SipSetup() {
  const { scheme: slug } = useParams();
  const navigate = useNavigate();
  const s = slug ? getFund(slug) : undefined;
  const [amount, setAmount] = useState("5000");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [day, setDay] = useState(5);

  if (!s) return <Navigate to="/home" replace />;

  const value = Number(amount);
  const belowMin = !!amount && value < s.sipMin;
  const preview = previewFirstDebit(day);
  const valid = !!amount && !belowMin;

  return (
    <Page>
      <Screen title="Set up a monthly SIP" onBack="auto"
        footer={
          <Button block disabled={!valid}
            onClick={() => navigate(`/sip/autopay/${slug}`, { state: { amount: value, frequency, day } })}>
            Continue
          </Button>
        }>
        <Reveal>
          <p className="mt-1 text-[14px] text-ink-soft">{s.name}</p>
          <div className="mt-4 flex items-end gap-1 border-b-2 border-line pb-3">
            <span className="font-display text-[28px] font-bold text-ink-soft">₹</span>
            <input autoFocus inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
              className="tnum w-full bg-transparent font-display text-[38px] font-bold outline-none" />
            <span className="pb-2 text-[14px] text-muted">/ month</span>
          </div>
          {belowMin ? (
            <p className="mt-2 text-[13px] font-medium text-recover">Minimum monthly SIP for this fund is {formatINR(s.sipMin)}</p>
          ) : (
            <p className="mt-2 text-[12.5px] text-muted">Invest this automatically every month.</p>
          )}
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">Frequency</p>
          <div className="flex gap-2">
            {(["monthly", "weekly"] as const).map((f) => (
              <button key={f} onClick={() => setFrequency(f)}
                className={`flex-1 rounded-2xl border py-2.5 text-[13.5px] font-medium capitalize ${frequency === f ? "border-ink bg-ink text-paper" : "border-line text-ink-soft"}`}>{f}</button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.14}>
          <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">Debit date each month</p>
          <div className="flex flex-wrap gap-2">
            {[1, 5, 10, 15, 20, 25].map((d) => (
              <button key={d} onClick={() => setDay(d)}
                className={`tnum h-11 w-11 rounded-xl border text-[14px] font-semibold ${day === d ? "border-ink bg-ink text-paper" : "border-line text-ink-soft"}`}>{d}</button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-6 rounded-2xl border border-line bg-card p-4">
            <p className="text-[13px] text-ink-soft">First instalment</p>
            <p className="mt-0.5 text-[15px] font-semibold">around {preview.human}</p>
            {preview.shifted && (
              <p className="mt-1.5 text-[12.5px] text-wait">
                {preview.tappedHuman} is a holiday — your debit will run the next working day, {preview.human}.
              </p>
            )}
          </div>
          <p className="mt-3 text-[12px] text-muted">We’ll invest <Money amount={value || 0} /> on the {ordinal(day)} of each month (or the next working day).</p>
        </Reveal>
      </Screen>
    </Page>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
