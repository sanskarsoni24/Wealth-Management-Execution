import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Reveal, Money, formatINR, Banner } from "@app/components/ui";
import { CutoffCountdown } from "@app/components/CutoffCountdown";
import {
  getFund, placeOrder, startPayment, paymentMethods, previewFirstDebit,
  type PayMethod, type PayMethodOption,
} from "@rail/index";
import { useSession } from "@app/context/Session";
import { useDevCutoff } from "@app/context/DevCutoff";

/**
 * Unified invest screen — amount + plan (Monthly SIP vs One-time) + payment method, all
 * on one page. SIP is the default; the user can switch to one-time. Replaces the old
 * separate amount / review / choose-payment screens. (No Review step — we confirm inline.)
 */
export default function InvestConfigure() {
  const { scheme: slug } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const { forcePassed } = useDevCutoff();
  const s = slug ? getFund(slug) : undefined;

  const [mode, setMode] = useState<"sip" | "once">("sip"); // SIP default
  const [amount, setAmount] = useState("5000");
  const [day, setDay] = useState(5);
  const [method, setMethod] = useState<PayMethod>("UPI");
  const [placing, setPlacing] = useState(false);
  const idemKey = useRef(`ord-${slug}-${Math.floor(Math.random() * 1e6)}`).current;

  if (!s || !session) return <Navigate to="/home" replace />;

  const value = Number(amount);
  const min = mode === "sip" ? s.sipMin : s.minAmount;
  let amountError: string | undefined;
  if (amount && value < min) amountError = mode === "sip" ? `Minimum monthly SIP for this fund is ${formatINR(min)}` : `This fund needs at least ${formatINR(min)}`;
  else if (mode === "once" && amount && value % s.multiple !== 0) amountError = `Please enter the amount in multiples of ${formatINR(s.multiple)}`;
  const amountOk = !!amount && !amountError;

  const methods = paymentMethods(session.accountId, value);
  const chosen = methods.find((m) => m.method === method);
  const methodOk = mode === "once" ? !!chosen?.available : true;
  const preview = previewFirstDebit(day);

  function go() {
    if (mode === "sip") {
      navigate(`/sip/autopay/${slug}`, { state: { amount: value, frequency: "monthly", day } });
      return;
    }
    // one-time: place the order, then start the chosen payment (no separate review screen)
    setPlacing(true);
    setTimeout(() => {
      const { orderId } = placeOrder({ accountId: session!.accountId, fundSlug: s!.slug, amount: value, idempotencyKey: idemKey, cutoffForcePassed: forcePassed });
      if (method === "MANDATE") { navigate(`/invest/autopay-debit/${orderId}`); return; }
      const { paymentId } = startPayment({ orderId, amount: value, method, idempotencyKey: `${idemKey}-${method}` });
      navigate(method === "UPI" ? `/invest/pay/${paymentId}` : `/invest/netbanking/${paymentId}`);
    }, 700);
  }

  return (
    <Page>
      <Screen title={s.name} onBack="auto"
        footer={
          <div className="space-y-2.5">
            {mode === "once" && <CutoffCountdown variant="line" />}
            <Button block loading={placing} disabled={!amountOk || !methodOk}
              onClick={go}>
              {!amountOk ? "Enter an amount to continue"
                : mode === "sip" ? <>Set up SIP of {<Money amount={value} />}/mo</>
                : <>Invest {<Money amount={value} />}</>}
            </Button>
          </div>
        }>
        {/* Plan toggle — SIP default */}
        <Reveal>
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-ink/[0.05] p-1">
            {([["sip", "Monthly SIP"], ["once", "One-time"]] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-xl py-2.5 text-[13.5px] font-semibold transition ${mode === m ? "bg-card text-ink shadow-card" : "text-ink-soft"}`}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted">
            {mode === "sip" ? "Invest a fixed amount automatically every month — our default for steady, disciplined investing." : "A single investment, paid now."}
          </p>
        </Reveal>

        {/* Amount */}
        <Reveal delay={0.06}>
          <div className="mt-5 flex items-end gap-1 border-b-2 border-line pb-3">
            <span className="font-display text-[28px] font-bold text-ink-soft">₹</span>
            <input autoFocus inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="0" className="tnum w-full bg-transparent font-display text-[38px] font-bold outline-none placeholder:text-line" />
            {mode === "sip" && <span className="pb-2 text-[14px] text-muted">/ month</span>}
          </div>
          {amountError ? <p className="mt-2 text-[13px] font-medium text-recover">{amountError}</p>
            : <p className="mt-2 text-[12.5px] text-muted">Minimum {mode === "sip" ? "monthly SIP" : "for this fund"} is {formatINR(min)}.</p>}
          <div className="mt-3 flex gap-2">
            {[1000, 5000, 10000].map((c) => (
              <button key={c} onClick={() => setAmount(String(c))}
                className="tnum flex-1 rounded-2xl border border-line bg-card py-2.5 text-[13.5px] font-semibold text-ink transition active:scale-95">{formatINR(c)}</button>
            ))}
          </div>
        </Reveal>

        {/* SIP: monthly + full-month calendar */}
        {mode === "sip" && (
          <Reveal delay={0.12}>
            <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">Monthly debit date</p>
            <MonthCalendar selected={day} onSelect={setDay} />
            <div className="mt-4 rounded-2xl border border-line bg-card p-4">
              <p className="text-[13px] text-ink-soft">First instalment</p>
              <p className="mt-0.5 text-[15px] font-semibold">around {preview.human}</p>
              {preview.shifted && <p className="mt-1.5 text-[12.5px] text-wait">{preview.tappedHuman} is a holiday — your debit will run the next working day, {preview.human}.</p>}
            </div>
            <p className="mt-3 text-[12px] text-muted">Next, approve a one-time auto-pay so your bank can run the SIP automatically.</p>
          </Reveal>
        )}

        {/* One-time: payment method (clubbed in) */}
        {mode === "once" && (
          <Reveal delay={0.12}>
            <p className="mt-6 mb-2 text-[13px] font-semibold text-ink-soft">Pay with</p>
            <div className="space-y-2">
              {methods.map((m: PayMethodOption) => (
                <button key={m.method} disabled={!m.available} onClick={() => setMethod(m.method)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    method === m.method && m.available ? "border-ink bg-ink/[0.04]" : "border-line"
                  } ${!m.available ? "opacity-50" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{m.label}{m.method === "UPI" && <span className="ml-2 rounded-full bg-saffron/15 px-2 py-0.5 text-[10px] font-bold text-saffron-ink">DEFAULT</span>}</p>
                    <p className="text-[11.5px] text-muted">{m.available ? m.note : m.reason}</p>
                  </div>
                  {m.available && (
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${method === m.method ? "border-ink bg-ink" : "border-line"}`}>
                      {method === m.method && <span className="h-2 w-2 rounded-full bg-paper" />}
                    </span>
                  )}
                </button>
              ))}
              <div className="flex w-full items-center justify-between rounded-2xl border border-line bg-ink/[0.02] px-4 py-3 opacity-50">
                <div><p className="text-[14px] font-semibold">Card</p><p className="text-[11.5px] text-muted">We can’t accept cards for fund purchases.</p></div>
              </div>
            </div>
            <div className="mt-4"><Banner tone="neutral">Whichever you pick, you’ll see the same honest steps — money received, then units allotted — and we’ll never imply units are yours before they are.</Banner></div>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}

/** A full-month date grid (1–28) — the SIP debit date, calendar-style. */
function MonthCalendar({ selected, onSelect }: { selected: number; onSelect: (d: number) => void }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
          <button key={d} onClick={() => onSelect(d)}
            className={`tnum aspect-square rounded-xl text-[13px] font-semibold transition ${
              selected === d ? "bg-ink text-paper" : "text-ink-soft hover:bg-ink/5"
            }`}>{d}</button>
        ))}
      </div>
      <p className="mt-2 px-1 text-[11px] text-muted">Pick any date from the 1st to the 28th. A debit on a holiday runs the next working day.</p>
    </div>
  );
}
