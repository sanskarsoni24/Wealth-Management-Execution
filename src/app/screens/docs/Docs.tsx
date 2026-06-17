import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import mermaid from "mermaid";
import { Page, Screen } from "@app/components/ui";

/**
 * /docs — the PRD's journey diagrams rendered for the eng + design teams, so they can
 * see the intended journey at a glance. Sources are the PRD appendix Mermaid.
 */
const ONBOARDING = `flowchart TD
Start([Open app]) --> Entry[Enter PAN + mobile]
Entry --> Resolve{Who is this?}
Resolve -->|Fully set up| FastInvest([Go straight to Invest])
Resolve -->|Partly done| Resume[Resume at the exact step]
Resolve -->|Brand new| KYC{Identity check}
KYC -->|Already verified| Account
KYC -->|Not found / old record| EKYC[Quick verification]
KYC -->|On hold| DeadEnd[Guided help route]
KYC -->|Service slow| SoftRetry[Soft retry]
SoftRetry -.retry.-> KYC
EKYC --> Account[Set up account + nominee]
Account --> Bank[Add bank · 1 rupee check]
Bank -->|Verified| Ready
Bank -->|Mismatch| BankFix[Fix or try another bank] --> Bank
Ready([Ready to invest · no auto-pay needed])
Resume --> Ready
FastInvest --> Ready
Ready -.only if SIP wanted.-> Mandate[Set up auto-pay]
Mandate --> MPend[Bank approving · SIP set]
MPend -->|Approved| MOK([Auto-pay ready])
MPend -->|Rejected| MFix[Try another bank / one-time]`;

const PURCHASE = `flowchart TD
Pick[Recommended fund] --> Amount[Enter amount]
Amount --> Review[Review · live cutoff countdown]
Review --> Place[[Tap Invest · locked, no double order]]
Place --> T1[Step 1 · Request received]
T1 --> T2[Step 2 · Confirmed with exchange]
T2 --> Pay{Pay by UPI}
T2 -.fund rejects later.-> Reject[Honest reversal · refund]
Pay -->|Approve| PSucc[Payment received]
Pay -->|Waiting| PPend[Approve in UPI app · do not close]
PPend -.timeout.-> PExp[Expired · retry]
Pay -->|Declined| PRej[Declined · retry]
Pay -->|Failed| PFail[Try another method]
PExp --> Pay
PRej --> Pay
PFail --> Pay
PSucc --> Gap[Money received · units by tomorrow]
PSucc -.debited but unconfirmed.-> Safe[Money is safe · auto-refund if unapplied]
Safe -.reconciled.-> Gap
Gap --> T3[Step 3 · Units in your account]
T3 --> Done([You own units])`;

export default function Docs() {
  const navigate = useNavigate();
  return (
    <Page>
      <Screen title="Journey diagrams" onBack={() => navigate("/")}>
        <p className="text-[13px] text-ink-soft">
          The intended journeys (from the PRD appendix). One PAN entry resolves new / partial / returning;
          identity has five outcomes; auto-pay is deferred out of the cold path. The purchase flow keeps the
          three truths distinct and treats every UPI + gap state as a designed screen.
        </p>
        <Diagram id="onb" def={ONBOARDING} title="Onboarding journey" />
        <Diagram id="pur" def={PURCHASE} title="Purchase journey" />
        <p className="mt-6 text-[11.5px] text-muted">
          For the engineering team: this prototype's mock rail (<code>src/rail/</code>) stands in for the real
          NSE MF Desk API. See <code>endpoints.md</code> for the real shapes it simulates.
        </p>
      </Screen>
    </Page>
  );
}

function Diagram({ id, def, title }: { id: string; def: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: {
      primaryColor: "#ffffff", primaryBorderColor: "#103a3c", primaryTextColor: "#103a3c",
      lineColor: "#2f6db5", fontFamily: "Hanken Grotesk, sans-serif", fontSize: "13px",
    }});
    mermaid.render(`m-${id}`, def).then(({ svg }) => setSvg(svg)).catch(() => setSvg("<p>diagram failed to render</p>"));
  }, [id, def]);
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-display text-[15px] font-semibold">{title}</h2>
      <div ref={ref} className="overflow-x-auto rounded-2xl border border-line bg-card p-3" dangerouslySetInnerHTML={{ __html: svg }} />
    </section>
  );
}
