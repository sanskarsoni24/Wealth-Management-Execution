import { Navigate, useNavigate } from "react-router-dom";
import { Page, Screen, Button, Card, Money, Pill, Reveal, ReturnsDisclaimer } from "@app/components/ui";
import { getPortfolio, listSips, listPlans, RECOMMENDED_FUND, type HoldingView, type SipView, type PlanView } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";
import { useSession } from "@app/context/Session";

/**
 * Home / portfolio. First-run is a teaching zero-state (recommend a first step, explain
 * how it works) — never a blank screen. A returning user sees holdings + SIPs that read
 * like a statement a human understands.
 */
export default function Home() {
  const navigate = useNavigate();
  const { session, setSession } = useSession();

  const { data: holdings } = useRailResource<HoldingView[]>(
    () => (session ? getPortfolio(session.accountId) : []),
    { pollMs: 1500, resourceMatch: "order" },
  );
  const { data: sips } = useRailResource<SipView[]>(
    () => (session ? listSips(session.accountId) : []),
    { pollMs: 1500, resourceMatch: "sip" },
  );
  const { data: plans } = useRailResource<PlanView[]>(
    () => (session ? listPlans(session.accountId) : []),
    { pollMs: 1500, resourceMatch: "plan" },
  );

  if (!session) return <Navigate to="/" replace />;

  const list = holdings ?? [];
  const sipList = sips ?? [];
  const planList = plans ?? [];
  const totalValue = list.reduce((s, h) => s + h.currentValue, 0);
  const totalInvested = list.reduce((s, h) => s + h.investedValue, 0);
  const gain = totalValue - totalInvested;
  const isEmpty = list.length === 0 && sipList.length === 0;

  return (
    <Page>
      <div className="flex h-full flex-col">
        {/* header */}
        <header className="bg-ink px-5 pb-6 pt-7 text-paper">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12.5px] text-paper/60">Hello, {session.holderName.split(" ")[0]}</p>
              <p className="font-display text-[16px] font-semibold">Your investments</p>
            </div>
            <button onClick={() => { setSession(null); navigate("/"); }}
              className="rounded-full bg-white/10 px-3 py-1.5 text-[11.5px] font-medium text-paper/80">Sign out</button>
          </div>
          {!isEmpty && (
            <Reveal delay={0.05}>
              <div className="mt-5">
                <p className="text-[12.5px] text-paper/60">Current value</p>
                <p className="tnum font-display text-[34px] font-bold leading-tight">{<Money amount={totalValue} />}</p>
                <p className="mt-1 text-[13px]">
                  <span className={gain >= 0 ? "text-[#7fe0ad]" : "text-[#ffb4a2]"}>
                    {gain >= 0 ? "▲" : "▼"} <Money amount={Math.abs(gain)} /> ({totalInvested ? ((gain / totalInvested) * 100).toFixed(1) : 0}%)
                  </span>
                  <span className="text-paper/50"> · invested <Money amount={totalInvested} /></span>
                </p>
              </div>
            </Reveal>
          )}
        </header>

        <div className="scroll-area flex-1 overflow-y-auto px-4 py-4 paper-grain">
          {isEmpty ? (
            <ZeroState onStart={() => navigate(`/invest/fund/${RECOMMENDED_FUND.slug}`)} />
          ) : (
            <>
              {/* recommended */}
              <Reveal>
                <Card className="!bg-ink/[0.03] !border-saffron/20">
                  <div className="flex items-center justify-between">
                    <Pill tone="neutral">★ Research pick</Pill>
                  </div>
                  <p className="mt-2 font-display text-[16px] font-semibold">{RECOMMENDED_FUND.name}</p>
                  <p className="mt-1 text-[12.5px] text-ink-soft">{RECOMMENDED_FUND.rationale}</p>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => navigate(`/invest/fund/${RECOMMENDED_FUND.slug}`)}>Invest</Button>
                    <Button variant="ghost" onClick={() => navigate(`/sip/setup/${RECOMMENDED_FUND.slug}`)}>Start a SIP</Button>
                  </div>
                </Card>
              </Reveal>

              {/* holdings */}
              {list.length > 0 && (
                <section className="mt-5">
                  <h2 className="mb-2 px-1 text-[13px] font-semibold text-ink-soft">Holdings</h2>
                  <div className="space-y-2.5">
                    {list.map((h, i) => (
                      <Reveal key={h.holdingId} delay={0.04 * i}>
                        <button onClick={() => navigate(`/holding/${h.holdingId}`)} className="w-full text-left">
                          <Card className="!p-4 transition active:scale-[0.99]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[14.5px] font-semibold">{h.schemeName}</p>
                                <p className="text-[12px] text-muted">{h.category} · {h.units} units</p>
                              </div>
                              <div className="text-right">
                                <p className="tnum text-[14.5px] font-semibold">{<Money amount={h.currentValue} />}</p>
                                <p className={`tnum text-[12px] ${h.returnPct >= 0 ? "text-ok" : "text-recover"}`}>
                                  {h.returnPct >= 0 ? "+" : ""}{h.returnPct}%
                                </p>
                              </div>
                            </div>
                          </Card>
                        </button>
                      </Reveal>
                    ))}
                  </div>
                </section>
              )}

              {/* SIPs */}
              {sipList.length > 0 && (
                <section className="mt-5">
                  <h2 className="mb-2 px-1 text-[13px] font-semibold text-ink-soft">Monthly SIPs</h2>
                  <div className="space-y-2.5">
                    {sipList.map((s) => (
                      <button key={s.sipId} onClick={() => navigate(`/sip/manage/${s.sipId}`)} className="w-full text-left">
                        <Card className="!p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[14px] font-semibold">{s.schemeName}</p>
                              <p className="text-[12px] text-ink-soft"><Money amount={s.amount} />/month</p>
                            </div>
                            <SipBadge sip={s} />
                          </div>
                        </Card>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* STP / SWP plans */}
              {planList.length > 0 && (
                <section className="mt-5">
                  <h2 className="mb-2 px-1 text-[13px] font-semibold text-ink-soft">Transfer & payout plans</h2>
                  <div className="space-y-2.5">
                    {planList.map((p) => (
                      <Card key={p.planId} className="!p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[14px] font-semibold">
                              {p.kind === "stp" ? `${p.fromName} → ${p.toName}` : `${p.fromName} → bank ···· ${p.bankLast4}`}
                            </p>
                            <p className="text-[12px] text-ink-soft">
                              {p.kind === "stp" ? "Auto-transfer" : "Auto-withdraw"} · <Money amount={p.amount} />/{p.frequency === "monthly" ? "mo" : "wk"} · from {p.firstDate}
                            </p>
                          </div>
                          <Pill tone={p.kind === "stp" ? "progress" : "wait"}>{p.kind === "stp" ? "Transfer" : "Payout"}</Pill>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              <div className="mt-5"><ReturnsDisclaimer /></div>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}

function SipBadge({ sip }: { sip: SipView }) {
  if (sip.phase === "awaiting_mandate") return <Pill tone="wait">Waiting for bank</Pill>;
  if (sip.phase === "active") return <Pill tone="ok">Live</Pill>;
  if (sip.phase === "paused") return <Pill tone="neutral">Paused</Pill>;
  return <Pill tone="neutral">{sip.phase}</Pill>;
}

function ZeroState({ onStart }: { onStart: () => void }) {
  const navigate = useNavigate();
  const s = RECOMMENDED_FUND;
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <Reveal>
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-saffron/15 text-saffron">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M4 16c4-1 6-9 8-9s4 8 8 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </div>
        <h1 className="mt-4 font-display text-[22px] font-bold tracking-tight">Your first investment starts here</h1>
        <p className="mt-2 max-w-[300px] text-[14px] text-ink-soft">
          No guesswork — our research team picks a sensible fund for a first-timer, and we handle
          the paperwork. You can start with as little as <Money amount={s.minAmount} />.
        </p>
      </Reveal>
      <Reveal delay={0.1}>
        <Card className="mt-6 w-full text-left !bg-ink/[0.03]">
          <div className="flex items-center justify-between">
            <Pill tone="neutral">★ Recommended for you</Pill>
            <span className="text-[12px] text-muted">{s.riskWords}</span>
          </div>
          <p className="mt-2 font-display text-[17px] font-semibold">{s.name}</p>
          <p className="mt-1 text-[13px] text-ink-soft">{s.rationale}</p>
          <Button block className="mt-4" onClick={onStart}>Invest now</Button>
          <Button block variant="ghost" className="mt-2" onClick={() => navigate(`/sip/setup/${s.slug}`)}>Or start a monthly SIP</Button>
        </Card>
      </Reveal>
      <Reveal delay={0.18}>
        <div className="mt-5 w-full rounded-2xl border border-line bg-card p-4 text-left">
          <p className="text-[12.5px] font-semibold text-ink-soft">How it works</p>
          <ol className="mt-2 space-y-1.5 text-[12.5px] text-ink-soft">
            <li>1 · Pick the recommended fund and an amount.</li>
            <li>2 · Pay by UPI — money in today, units priced at today’s NAV.</li>
            <li>3 · Units show up by the next day. Automate it with a SIP whenever you like.</li>
          </ol>
        </div>
      </Reveal>
    </div>
  );
}
