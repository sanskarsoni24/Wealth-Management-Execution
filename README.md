# Invest · Onboard · SIP — execution prototype

A **clickable, fully-interactive prototype** of a consumer mutual-fund app for India retail
(Maitri), focused on the **execution flows**. It demonstrates the *async, delayed,
sometimes-failing* reality of the underlying NSE MF rail, which is **mocked entirely in-memory**.

> **The cardinal rule:** the customer never sees the rail. No UCC, EUIN, UMRN, folio, NAV cutoff,
> "TRXN SUCCESS", `client_code`, or even `STP`/`SWP` acronyms appear in the UI. The rail's
> mechanical, regulated, delayed reality is translated into something that feels instant, certain,
> and trustworthy — while never lying about money.

## Scope of this build

**Onboarding has been removed** — the app boots straight into a fully set-up investor (seeded
holdings + an approved auto-pay) so every execution flow is reachable immediately. What's covered:

- **Buy (lumpsum, §3.2)** — fund → amount → review + live cutoff → three-truths tracker → pay →
  money-in-units-pending gap → allotment.
- **Payment methods (§6.5 / 8.5)** — a method chooser (UPI default), **net-banking** redirect
  states (incl. came-back-without-paying, bank-down, debited-but-unconfirmed), and
  **pay-using-your-auto-pay** (bounded by the ceiling, bank-debit timing).
- **SIP (§3.3)** — amount/date → auto-pay ceiling → AWAITING approval → ACTIVE with a real first
  debit date → manage (pause/step-up/cancel).
- **Redeem (§3.4)** — indicative payout + exit load + lock-in → review → payout tracker.
- **Switch (§4.1)** — "Move your money to another fund": the sell→buy legs, the **in-motion gap**
  named explicitly, and the one-leg-fails return path.
- **Move money regularly (STP, §4.2)** — automatic fund→fund transfer; no bank debit; source-runs-low note.
- **Get paid regularly (SWP, §4.3)** — automatic fund→bank payout with a plain-language depletion estimate.

Every screen still answers the litmus test (loading / pending / empty / error) with the PRD's
literal microcopy, and every state resolves through the three truths and the "is my money in?" /
reconciliation treatments.

## What this is — and what it is NOT

- ✅ A prototype for an **engineering team** (who will rebuild against the live rail) and a
  **design team**.
- ✅ Faithful to the rail's behavior: writes return an `id` + initial `status`, then resolve
  **later** via polling **and** a simulated **webhook** (event bus).
- ❌ **NOT** production code. No real NSE call, no credentials, no real money, no auth, no DB. State
  lives in memory and resets on reload.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 — lands directly on the portfolio
```

## The dev control panel (the demo superpower)

Press **Ctrl + Shift + D**. From there a presenter can:

- **Fast-forward** any pending resource, or scrub `timeScale` (1× / 4× / 20×) to run multi-day
  waits in seconds.
- **Force the next outcome** of mandate (auto-pay approval), payment (incl. *debited-but-failed*),
  and order / switch buy-leg (allot / reject).
- **Jump the NAV cutoff** (Before / After / Real clock) to flip the countdown + priced-NAV copy.
- **Reset** all in-memory state; watch a **live log** of every rail transition.

## Where to start clicking

The app opens on the portfolio of a set-up investor with two holdings.
- **Buy:** tap the **Invest** card → amount → Review → **Invest** → on the order, **Pay** → pick a
  method (UPI / net-banking / auto-pay).
- **Switch / STP / SWP:** tap a **holding** → "More ways to move this money".
- **Redeem:** tap a **holding** → Withdraw.
- **SIP:** complete a buy → on allotment, **Make this automatic**.
- Use the dev panel to force the failure branches and fast-forward the waits.

## Architecture (mirrors production topology)

```
React + Tailwind app  →  src/rail/client.ts  →  mock rail (in-memory)   ✗ NO NSE
   (src/app/*)            (THE PROD SEAM)        (state machines + timers + webhooks)
```

- **`src/rail/`** — the mock backend. State machines per gate (`machines/`), a timer `scheduler`,
  a pub/sub `bus` (webhooks + live log), an `idempotency` registry, and `client.ts` — the **only**
  module the app imports. It returns *consumer-shaped* view models and strips all rail vocabulary
  (including `schemeCode`, exposed to the app only as opaque fund **slugs**).
- **`src/app/`** — screens map to the PRD; trust components (`OrderTracker`, `CutoffCountdown`, the
  payment + money-safe states) live in `components/`. Execution flows: `screens/invest`,
  `screens/sip`, `screens/redeem`, `screens/move` (switch/STP/SWP).
- **`src/devpanel/`** — the dev panel (not shipped to production).

## Design language — "calm ledger"

Green (`--ok`) is used **only** for *earned* completion (units allotted, payout paid, auto-pay
live); in-progress is calm blue, healthy waits teal, recoverable errors a warm clay. Deep ink-teal
+ warm paper + a saffron CTA. Type: Bricolage Grotesque (display) + Hanken Grotesk (body, tabular
figures). Mobile-first, phone-framed on desktop.

## For the engineering team

The rail this mock stands in for is the **NSE MF Desk API (`nsemfdesk` v2)** — see `endpoints.md`.
Auth is server-side only and never lives in the client; the app talks to *your* backend, which
talks to NSE. This prototype mocks *your backend*; `src/rail/client.ts` is where you swap in real
network calls.

> `PLAN.md` and `ACCEPTANCE.md` document the original full build (incl. onboarding). This branch
> removes onboarding and adds Switch/STP/SWP + payment methods per the §4 / §6.5 spec.
