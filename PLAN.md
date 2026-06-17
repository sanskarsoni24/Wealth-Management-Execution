# PLAN — "Invest · Onboard · SIP" clickable prototype

> A handoff-ready, demoable prototype of a consumer mutual-fund app for India retail.
> Faithful to the PRD's flows + literal copy, and to the *async, delayed, sometimes-failing*
> reality of the NSE MF rail — which is mocked entirely in-memory. **No real NSE, no money, no auth.**
>
> This document is for the **engineering team** (who will rebuild against the live rail) and the
> **design team** (who will refine flows/copy/visuals). Read it top to bottom.

---

## 0. The one rule, encoded as build constraints

**The customer never sees the rail.** These become hard rules in the code, not aspirations:

| Rule | How it's enforced in this build |
|---|---|
| No rail vocabulary in UI (UCC, EUIN, UMRN, folio, NAV cutoff, "TRXN SUCCESS", `client_code`) | All such fields live only in `src/rail/*` (the mock backend). The app layer receives a **consumer-shaped** view model; rail ids are never rendered. A lint check (grep in `ACCEPTANCE.md`) greps `src/app` for banned terms. |
| Three truths, never one green tick | `OrderTracker` is a 3-step component. Green (`--ok`) is a reserved token used **only** at step 3 / allotment. Steps 1–2 use neutral/blue progress tokens. |
| "Order placed" ≠ "you own units" | The order state machine keeps `ACCEPTED`, `CONFIRMED`, `ALLOTTED` distinct; UI copy is the PRD's literal strings per state. |
| Pending is the hero | Every async screen renders 4 states (loading / pending / empty / error) from a shared `<AsyncState>` contract. No bare spinners on money screens — pending = dated, reassuring, with a timeline. |
| No dark patterns | Countdown is calm-by-default; amber/urgency only in final minutes; never a "buy now or lose out" frame. Color/copy reviewed against this in `ACCEPTANCE.md` #6. |

---

## 1. Stack & why

- **Vite + React 18 + TypeScript + Tailwind CSS + React Router** — one `npm install && npm run dev`, no external services.
- **Mock backend = in-process module** (`src/rail/`), not MSW. Rationale: the rail's value is its *timers, state machines, and webhooks*; an in-process service with a real event bus models that more transparently than HTTP interception, and the eng team can read the state machines directly. The app talks to it **only** through `src/rail/client.ts` — a Promise-based, fetch-shaped API. That file is the seam that production replaces with real HTTP-to-your-backend calls.
- **framer-motion** for calm, orchestrated motion (respects `prefers-reduced-motion`).
- **mermaid** to render the PRD's journey diagrams in a `/docs` route.
- No state library; React context for the onboarding session + a tiny `useRailResource` polling/subscription hook.

```
┌────────────────────────┐     async + webhooks      ┌──────────────────────────────┐
│  app  (src/app/*)       │  ───────────────────────▶ │  mock rail  (src/rail/*)       │   ✗ NO NSE
│  React/Tailwind         │  ◀─── poll / event bus ─── │  in-memory, resets on reload   │
│  consumer-shaped only   │     src/rail/client.ts     │  state machines + timers       │
└────────────────────────┘      (the prod seam)       └──────────────────────────────┘
```

---

## 2. Mock backend (`src/rail/`) — the part that makes this valuable

### 2.1 Modules
- `config.ts` — timing config, all overridable by dev panel:
  `{ kycCheckMs:800, ekycStepMs:1200, uccCreateMs:3000, pennyDropMs:2000, mandateApproveMs:8000, paymentResolveMs:6000, paymentExpiryMs:30000, allotmentMs:15000, cutoffHour:15, timeScale:1 }`. `timeScale` multiplies every timer.
- `store.ts` — in-memory `Map`s per resource; `reset()` re-seeds personas.
- `bus.ts` — tiny pub/sub `EventEmitter`. Webhooks + the dev-panel live log subscribe here. Every state transition emits `{ resource, id, from, to, detail, at }`.
- `scheduler.ts` — `schedule(id, fn, ms)` using `timeScale`; supports `fastForward(id)` (fire now) and cancel. This is how PENDING→terminal happens "later."
- `idempotency.ts` — `Map<idempotencyKey, resourceId>`; re-sending a key returns the same resource (acceptance #9).
- `seed.ts` — the five personas + bad/unsupported banks + returning-user UCC/mandate/holding.
- `machines/` — one file per gate: `kyc.ts`, `ekyc.ts`, `account.ts` (UCC+penny-drop), `mandate.ts`, `orders.ts`, `sip.ts`, `payments.ts`.
- `client.ts` — **the only thing the app imports.** Consumer-shaped functions; strips rail vocabulary; returns `{ id, status, statusDetail, nextPollAfterMs, ...viewModel }`.
- `forces.ts` — dev-panel "force next outcome" registers (next KYC result, penny-drop, mandate, payment, order).

### 2.2 Seed personas (type a PAN to pick the branch)
| PAN | KYC result | Demonstrates |
|---|---|---|
| `AAAPA1111A` | VERIFIED | Returning fast-path — pre-seeded UCC + approved mandate + one holding (also enables redemption + SIP demos) |
| `BBBPB2222B` | NOT_FOUND | First-timer, full e-KYC |
| `CCCPC3333C` | INCOMPLETE | "You think you're KYC'd but aren't" re-verification |
| `DDDPD4444D` | ON_HOLD | Graceful dead-end → help route |
| `EEEPE5555E` | SERVICE_DOWN | KRA down → soft-fail + retry |

Bad bank account `0000000000` → `NAME_MISMATCH`; IFSC prefix `XXXX` → mandate `UNSUPPORTED_BANK`.

### 2.3 State machines (with default timers, all `× timeScale`)
- **KYC** `POST /kyc/check` → one of `VERIFIED | NOT_FOUND | INCOMPLETE | ON_HOLD | SERVICE_DOWN` after `kycCheckMs`.
- **e-KYC** (resumable) `STARTED → AADHAAR_SENT → AADHAAR_VERIFIED → LIVENESS_OK → SUBMITTED → VERIFIED`, or `FAILED(reason)` at any step. `GET /kyc/ekyc/{id}` returns furthest completed step → drives resume.
- **Account/UCC** `PENDING → ACTIVE` after `uccCreateMs`, returns synthetic `clientCode` (kept internal). Bank sub-state `bankStatus: PENDING → VERIFIED | NAME_MISMATCH | FAILED` after `pennyDropMs`.
- **Mandate** `PENDING → APPROVED` after `mandateApproveMs`, or `REJECTED | UNSUPPORTED_BANK`. Stores `maxAmount` ceiling.
- **Orders** `ACCEPTED` (immediate, with `navDate` + `cutoffPassed`) → `CONFIRMED` (on payment success) → `ALLOTTED` after `allotmentMs` (units+NAV). Branches `REJECTED` (forceable) / `CANCELLED`. Redeem: `ACCEPTED → PROCESSING → PAID_OUT`. Cancel allowed only while `cutoffPassed=false && status=ACCEPTED`, else returns a human reason.
- **SIP** `AWAITING_MANDATE → ACTIVE` (real `firstDebitDate` when mandate approves). `amount > maxAmount` → `EXCEEDS_MANDATE` with raise-limit affordance.
- **Payments** `PENDING → SUCCESS | FAILED | EXPIRED | REJECTED`. Default → `SUCCESS` after `paymentResolveMs`; auto-`EXPIRED` after `paymentExpiryMs` if unresolved. **Webhook** fires on resolution via `bus`. On `SUCCESS`, linked order goes `ACCEPTED→CONFIRMED`; allotment still lags `allotmentMs` = the deliberate **money-in-units-pending gap**. `forcePaymentDebitedButFailed` → `FAILED` while signaling money left the account → app shows reconciliation "money safe" state.

### 2.4 The app↔rail contract (how UI gets liveness)
`useRailResource(id, fetcher)` hook: initial fetch → schedules re-poll using `nextPollAfterMs` → **also** subscribes to `bus` for that id so webhook-driven screens (payment) update instantly, not just on poll tick. Returns `{ data, status, error }`.

---

## 3. Screen map — every screen → its 4 states

States legend: **L**oading · **P**ending · **E**mpty · **Er**ror. "n/a (why)" where the PRD says a state can't occur. Copy = PRD literal strings.

### 3.1 Onboarding (`/onboard/*`)
| Route | PRD | L | P | E | Er |
|---|---|---|---|---|---|
| `/onboard/identity` | 3.1.1 resolver (PAN+mobile) | "Just a moment…" | service slow soft-wait | n/a (first screen) | invalid PAN / partner unreachable |
| `/onboard/otp` | 3.1.2 mobile OTP | "Verifying…" | n/a (sync) | resend timer | wrong/expired / paused 10 min |
| `(routing)` | 3.1.3 five-way fork | "Checking your details…" | partner slow | not-found→quick verify | on-hold→help route |
| `/onboard/ekyc/aadhaar` | 3.1.4 Aadhaar OTP (resumable) | "Sending… / Verifying…" | "Still sending…" | "Didn't receive it? Resend" | code/timeout, progress saved |
| `/onboard/ekyc/selfie` | 3.1.5 liveness | "Checking… keep this screen open" | "Processing…" | camera denied→Open settings | liveness failed→retry / another way |
| `/onboard/account` | 3.1.6 account+tax | "Setting up your account…" | "we'll notify you" | n/a (pre-filled) | PAN-name mismatch / foreign tax → route; create fail→retry |
| `/onboard/nominee` | 3.1.7 nominee | "Saving…" | n/a (sync) | opt-out recorded | shares ≠ 100% |
| `/onboard/bank` | 3.1.8 penny-drop | "Confirming… few seconds" | "bank taking a moment" | n/a (single input) | mismatch / wrong / unsupported |
| `/onboard/ready` | 3.1.9 you're ready | n/a (local) | account finalising→browse-gated | n/a | n/a (handled upstream) |
| `/onboard/help` | ON_HOLD dead-end | — | — | — | emailed steps + Talk to support |

### 3.2 Purchase (`/invest/*`)
| Route | PRD | states |
|---|---|---|
| `/invest/fund/:scheme` | 3.2.1 fund detail | L fetch NAV · P n/a · E no pick→shortlist · Er suspended/unavailable |
| `/invest/amount` | 3.2.2 amount | local; E "enter amount"/min · Er below-min/multiple |
| `/invest/review` | 3.2.3 review + **cutoff object** | L "Placing… don't close" (locked) · P after-cutoff next-day copy · Er reconcile no-double |
| `/invest/order/:id` | 3.2.4 **three truths** tracker | L between steps · P accepted-awaiting · Er fund reject→honest reversal+refund |
| `/invest/pay/:id` | 3.2.5 **five UPI states** | L "Setting up payment…" · P approve+live timer · Er EXPIRED/REJECTED/FAILED distinct screens |
| `(in tracker)` | 3.2.6 **money-in-units-pending gap** | P dated timeline · Er debited-but-unconfirmed→"money safe" reconciliation |
| `(in tracker)` | 3.2.7 allotment complete | only here: green success + units/price |

### 3.3 SIP (`/sip/*`)
| Route | PRD | states |
|---|---|---|
| `/sip/setup` | 3.3.1 amount/freq/date | E "choose amount" · Er below-min / holiday→effective date |
| `/sip/autopay` | 3.3.2 **ceiling** | L "Sending to your bank…" · P "bank approving, SIP already set" · Er EXCEEDS_MANDATE raise-limit / bank declined |
| `/sip/confirmed/:id` | 3.3.3 SIP confirmed (auto-pay pending) | P "waiting for bank approval" on card · Er approval rejected |
| `/sip/:id` | 3.3.4 active + 3.3.5 manage | P approved-after-date this/next cycle; change-next-cycle · E no SIPs · Er lock-window / step-up ceiling / instalment failed |

### 3.4 Redemption (`/redeem/*`, `/holding/:id`)
| Route | PRD | states |
|---|---|---|
| `/holding/:id` | 3.4.1 holding→redeem | L load value · E units pending→can't redeem yet · Er value unavailable |
| `/redeem/:id/amount` | 3.4.2 indicative + exit load + lock-in | L "Working out payout…" · E "enter amount" · Er exceeds / ELSS lock-in / min-balance |
| `/redeem/:id/review` | 3.4.3 review (honesty banner) | L "Placing…" locked · P after-cutoff · Er reconcile no-double |
| `/redeem/order/:id` | 3.4.4 progress + payout | L between steps · P settlement-days dated · Er payout bounced→fix bank+resend |

### Home / shell
- `/` → splash → `/onboard/identity`.
- `/home` — portfolio. **E** = first-run zero-state (teach + invite, not blank). Lists holdings + SIPs for returning user.
- `/docs` — rendered Mermaid journey diagrams (onboarding + purchase).

---

## 4. Trust moments (§4) — the emotional core, built as dedicated components
1. **`<CutoffCountdown>`** — live ticking object. Before cutoff: calm "Invest by 3:00 PM for today's price · 2h 14m left." Final minutes: mild emphasis only. After cutoff: flips to expectation-setter (next market day). Holidays/weekends: shows **effective** date, never the tapped date. No coercion.
2. **`<OrderTracker>`** — 3 nodes (received / accepted / allotted). Reserved green only at node 3 + push toast.
3. **`<PaymentScreen>`** — all five UPI outcomes as distinct screens with distinct copy + specific recovery; webhook-driven live update.
4. **`<MoneySafeState>`** — money-in-units-pending (healthy, dated) and the worst case (debited-but-unconfirmed → "Your money is safe", SLA, Track / Talk to our team). Never a dead "failed" screen.

Every state change also fires a **push/email toast** (approved, paid, allotted, refunded, failed) so the user never has to open the app to learn where their money is.

---

## 5. Visual design — deliberate, non-templated, trust-first

**Audience:** anxious first-timer, mid/low-end Android, patchy network. The aesthetic must read as **calm, certain, legible** — closer to a trustworthy passbook than a flashy trading app. Mobile-first, rendered in a phone frame on desktop.

**Concept: "Calm ledger."** Warm paper surfaces, deep ink-teal authority, one warm saffron accent for brand/CTA moments, and a **semantic status system where green is *earned*.**

- **Reserved-green principle (directly serves the product thesis):** green = `--ok` is used **only** for true completion (units allotted, payout paid, mandate approved-and-live). So the brand color is *not* green. In-progress uses calm blue/slate, never success-green — this is what stops the "green tick at accepted" failure.
- **Palette (CSS variables):**
  - `--ink` deep teal `#103A3C` (primary text/brand authority)
  - `--paper` warm off-white `#FAF6EE` (app surface)
  - `--card` `#FFFFFF` with soft warm shadow
  - `--saffron` `#E0852B` (brand accent / primary CTA) — warmth, optimism, India-grounded, *not* green
  - `--ok` `#1E8A5A` (reserved success green)
  - `--progress` `#2F6DB5` (calm blue — in-progress, accepted, "we're on it")
  - `--wait` `#3A7D7E` (teal — healthy pending / "money safe")
  - `--recover` `#B6543B` (warm clay — recoverable error; *not* alarm-red)
  - Urgency amber `#C9892A` appears only in countdown's final minutes.
- **Typography (not Inter/Roboto/Space Grotesk):** Display **Bricolage Grotesque** (characterful, modern, confident headings); UI/body **Hanken Grotesk** (highly legible at small sizes, friendly, supports **tabular figures** — essential for money/amounts/countdowns). Money values use `font-variant-numeric: tabular-nums`.
- **Motion (framer-motion, `prefers-reduced-motion` honored):** one orchestrated staggered reveal per screen load; the pending timeline node "breathes" gently (not a frantic spinner); tracker steps advance with a calm fill. High-impact, low-frequency.
- **Texture/depth:** subtle paper grain on `--paper`, soft layered shadows, generous spacing, large tap targets (≥44px). No purple-gradient-on-white anywhere.

---

## 6. Dev control panel (the demo superpower)
Floating panel toggled by **Ctrl+Shift+D**:
- **Fast-forward** any pending resource to terminal state instantly (`scheduler.fastForward`).
- **Force next outcome:** KYC result · penny-drop · mandate (approve/reject/unsupported) · payment (success/fail/expired/rejected/**debited-but-failed**) · order (allot/reject).
- **Jump NAV cutoff** — toggle `cutoffPassed` to demo countdown + next-day copy.
- **Reset** to seeded personas.
- **Live transition log** — every `bus` event, newest first, so a presenter narrates "what the rail is doing."
- **timeScale slider** + a "fast-forward demo" button that drops timeScale to 0.05.

---

## 7. Repo layout
```
src/
  rail/            mock backend: config, store, bus, scheduler, idempotency, seed, forces, machines/, client.ts
  app/
    components/    AsyncState, OrderTracker, CutoffCountdown, PaymentScreen, MoneySafeState, PhoneFrame, Toast…
    screens/       onboarding/  invest/  sip/  redeem/  home/  docs/
    context/       OnboardingSession, RailToasts
    hooks/         useRailResource, useCountdown
    theme/         tokens.css, fonts
  devpanel/        DevPanel.tsx (Ctrl+Shift+D)
docs/              mermaid sources
PLAN.md  ACCEPTANCE.md  README.md
```

## 8. Build order
1. Mock backend (`src/rail/*`) + dev panel + a tiny debug page to drive machines — **first**, so UI reacts to real async from day one.
2. App shell, theme tokens, PhoneFrame, AsyncState contract, Toast.
3. Onboarding journey (all 5 personas) → prove acceptance #1, #2.
4. Purchase journey (tracker, 5 UPI states, gap, reconciliation, idempotency) → #5, #7, #8, #9.
5. SIP journey (AWAITING_MANDATE→ACTIVE, EXCEEDS_MANDATE) → #3, #4.
6. Redemption journey + home/zero-state.
7. Cutoff demo wiring → #6; sweep every failure path → #10.
8. `/docs` Mermaid render, README, ACCEPTANCE click-paths.

## 9. How each of the 10 acceptance items is proven
Full click-paths go in `ACCEPTANCE.md`; summary:
1. 5 PANs → 5 visibly different branches. 2. `AAAPA1111A` skips bank/account/mandate. 3. SIP before approval → "waiting for bank approval" → dev-panel approve → ACTIVE + first-debit date. 4. SIP amount > ceiling → EXCEEDS_MANDATE + raise-limit. 5. Tracker shows received→accepted→allotted over time. 6. Dev-panel jump cutoff → copy flips. 7. Dev-panel forces each UPI state incl. let-it-EXPIRE + debited-but-failed. 8. Money-in-units-pending = dated timeline screen. 9. Re-submit same `idempotencyKey` → same `orderId`. 10. Every failure path → specific recovery (grep proves no generic error string).

## 10. Out of scope (built as honest dead-ends only)
SIP-first cold onboarding, switch/STP/SWP, demat mode, NRI/minor/joint/HUF, non-MF products, goal planning/analytics, non-UPI payment, in-app chat advisory, FATCA-complex. Where the PRD shows a dead-end/waitlist (NRI, minor, foreign tax residency), that dead-end screen is built; the feature is not.
```
