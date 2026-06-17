import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Page, Screen, Button, Card, Reveal, Money } from "@app/components/ui";
import { getPlan } from "@rail/index";

/** §4.3 — SWP confirmed. First payout scheduled to the bank. */
export default function SwpConfirmed() {
  const { swpId } = useParams();
  const navigate = useNavigate();
  const plan = swpId ? getPlan(swpId) : undefined;
  if (!plan) return <Page><Screen title="Payout plan" /></Page>;

  return (
    <Page>
      <Screen title="" footer={<Button block onClick={() => navigate("/home")}>Done</Button>}>
        <div className="flex flex-col items-center pt-10 text-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 360, damping: 18 }}
            className="grid h-16 w-16 place-items-center rounded-full bg-ok-bg text-ok">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </motion.div>
          <Reveal delay={0.1}>
            <h1 className="mt-5 font-display text-[24px] font-bold tracking-tight">Payouts set</h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              <Money amount={plan.amount} /> {plan.frequency} from {plan.fromName}.
            </p>
            <p className="mt-1 text-[14px] text-ink-soft">
              First payout on <span className="font-semibold text-ink">{plan.firstDate}</span> to your bank ending <span className="tnum font-semibold">{plan.bankLast4}</span>.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.18}>
          <Card className="mt-6 !bg-ink/[0.02]">
            <p className="text-[12.5px] text-ink-soft">Each payout reduces your holding and can eventually deplete it. The exact amount is set at the day’s price, so it can vary slightly.</p>
          </Card>
        </Reveal>
      </Screen>
    </Page>
  );
}
