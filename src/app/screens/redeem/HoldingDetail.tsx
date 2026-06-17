import { useNavigate, useParams } from "react-router-dom";
import { Page, Screen, Button, Card, Banner, Reveal, Money } from "@app/components/ui";
import { getHolding, type HoldingView } from "@rail/index";
import { useRailResource } from "@app/hooks/useRailResource";

/**
 * 3.4.1 — Holding detail → redeem. Full vs partial chosen here. Empty: units still
 * pending allotment (can't redeem yet). Redemption is the highest-regret flow, so we're
 * honest up front about lock-ins and exit loads.
 */
export default function HoldingDetail() {
  const { holdingId } = useParams();
  const navigate = useNavigate();
  const { data: h } = useRailResource<HoldingView | undefined>(
    () => (holdingId ? getHolding(holdingId) : undefined),
    { pollMs: 1500, resourceMatch: "order" },
  );

  if (!h) return <Page><Screen title="Holding" onBack="auto"><Banner tone="recover" title="We can’t load this holding’s value right now">Try again shortly.</Banner></Screen></Page>;

  const locked = !!h.lockedUntilIso && new Date(h.lockedUntilIso) > new Date();

  return (
    <Page>
      <Screen title="" onBack="auto"
        footer={
          h.pendingAllotment ? null : locked ? (
            <Button block disabled>Locked until {h.lockedUntil}</Button>
          ) : (
            <div className="space-y-2">
              <Button block onClick={() => navigate(`/redeem/${h.holdingId}/amount`, { state: { all: true } })}>Withdraw everything</Button>
              <Button block variant="ghost" onClick={() => navigate(`/redeem/${h.holdingId}/amount`, { state: { all: false } })}>Withdraw part of it</Button>
            </div>
          )
        }>
        <Reveal>
          <p className="mt-2 text-[13px] text-muted">{h.category}</p>
          <h1 className="font-display text-[22px] font-bold tracking-tight">{h.schemeName}</h1>
        </Reveal>

        <Reveal delay={0.06}>
          <Card className="mt-4">
            <p className="text-[13px] text-ink-soft">Current value</p>
            <p className="tnum font-display text-[30px] font-bold">{<Money amount={h.currentValue} />}</p>
            <div className="mt-2 flex items-center gap-2 text-[12.5px]">
              <span className={h.returnPct >= 0 ? "text-ok" : "text-recover"}>{h.returnPct >= 0 ? "▲" : "▼"} {Math.abs(h.returnPct)}%</span>
              <span className="text-muted">· invested <Money amount={h.investedValue} /> · {h.units} units</span>
            </div>
          </Card>
        </Reveal>

        {h.pendingAllotment && (
          <Reveal><div className="mt-4"><Banner tone="wait" title="These units are still being allotted">
            You can withdraw once they’re in (expected by tomorrow).
          </Banner></div></Reveal>
        )}

        {locked && (
          <Reveal><div className="mt-4"><Banner tone="wait" title={`Locked until ${h.lockedUntil}`}>
            These units are under a 3-year rule (ELSS) and can’t be withdrawn yet. We’ll let you know when they unlock.
          </Banner></div></Reveal>
        )}

        {!locked && h.exitLoadPct > 0 && (
          <Reveal><div className="mt-4"><Banner tone="neutral" title={`A small exit charge applies (${h.exitLoadPct}%)`}>
            Withdrawing now incurs a {h.exitLoadPct}% exit load. We’ll show you the exact net amount before you confirm.
          </Banner></div></Reveal>
        )}

        {!h.pendingAllotment && (
          <Reveal delay={0.12}>
            <p className="mt-6 mb-2 px-1 text-[13px] font-semibold text-ink-soft">More ways to move this money</p>
            <div className="space-y-2">
              <ActionRow label="Move to another fund" desc="Switch this into a different fund (one-time)"
                disabled={locked} onClick={() => navigate(`/switch/${h.holdingId}`)} />
              <ActionRow label="Move money regularly" desc="Auto-transfer into another fund"
                disabled={locked} onClick={() => navigate(`/stp/${h.holdingId}/setup`)} />
              <ActionRow label="Get paid regularly" desc="Auto-withdraw to your bank"
                disabled={locked} onClick={() => navigate(`/swp/${h.holdingId}/setup`)} />
            </div>
          </Reveal>
        )}
      </Screen>
    </Page>
  );
}

function ActionRow({ label, desc, onClick, disabled }: { label: string; desc: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-50">
      <div>
        <p className="text-[14px] font-semibold">{label}</p>
        <p className="text-[12px] text-muted">{desc}</p>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-muted"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}
