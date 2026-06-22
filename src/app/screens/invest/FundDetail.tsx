import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Card, Banner, Pill, Reveal, LoadingBlock, ReturnsDisclaimer, Money } from "@app/components/ui";
import { getFund } from "@rail/index";

/**
 * 3.2.1 — Fund detail (advisor recommendation). Plain-language rationale, risk level
 * in WORDS, past performance with the mandatory disclaimer, and an honest, non-
 * guaranteed view of returns. Error: scheme suspended for new purchases.
 */
export default function FundDetail() {
  const { scheme: slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const s = slug ? getFund(slug) : undefined;

  useEffect(() => { const t = setTimeout(() => setLoading(false), 550); return () => clearTimeout(t); }, []);

  if (loading) {
    return <Page><Screen title="" onBack="auto"><LoadingBlock label="Loading fund details…" /></Screen></Page>;
  }

  if (!s) {
    return (
      <Page><Screen title="" onBack="auto">
        <Banner tone="recover" title="We can’t load this fund right now">Please try again shortly.</Banner>
      </Screen></Page>
    );
  }

  return (
    <Page>
      <Screen title="" onBack="auto"
        footer={
          s.closedToNew
            ? <Button block disabled>Not accepting new investments</Button>
            : <Button block onClick={() => navigate(`/invest/configure/${s.slug}`)}>Invest</Button>
        }>
        <Reveal>
          <Pill tone="neutral">★ Research pick</Pill>
          <h1 className="mt-3 font-display text-[24px] font-bold leading-tight tracking-tight">{s.name}</h1>
          <p className="mt-1 text-[13px] text-muted">{s.category} · {s.riskWords}</p>
        </Reveal>

        {s.closedToNew && (
          <Reveal>
            <div className="mt-4"><Banner tone="recover" title="This fund isn’t accepting new investments at the moment">
              We’ll let you know when it reopens. Meanwhile, see other research picks.
            </Banner></div>
          </Reveal>
        )}

        <Reveal delay={0.08}>
          <Card className="mt-5 !bg-ink/[0.02]">
            <p className="text-[13px] font-semibold text-ink">Why our research team likes this for you</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{s.rationale}</p>
          </Card>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Stat label="NAV today" value={`₹${s.nav.toFixed(2)}`} />
            <Stat label="1-yr (past)" value={`${s.oneYear}%`} />
            <Stat label="3-yr (past)" value={`${s.threeYear}%`} />
          </div>
          <p className="mt-2 text-[12px] font-medium text-ink-soft">
            Returns aren’t guaranteed — past performance doesn’t predict the future.
          </p>
        </Reveal>

        {s.isElss && (
          <Reveal delay={0.18}>
            <div className="mt-4"><Banner tone="wait" title="3-year lock-in">
              This is a tax-saving fund — money stays invested for at least 3 years before you can withdraw.
            </Banner></div>
          </Reveal>
        )}

        <Reveal delay={0.22}>
          <div className="mt-4 text-[12.5px] text-ink-soft">
            <span className="font-semibold">Minimum:</span> <Money amount={s.minAmount} /> · in multiples of <Money amount={s.multiple} />
          </div>
          <div className="mt-4"><ReturnsDisclaimer /></div>
        </Reveal>
      </Screen>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3 text-center">
      <p className="tnum text-[15px] font-bold">{value}</p>
      <p className="mt-0.5 text-[10.5px] text-muted">{label}</p>
    </div>
  );
}
