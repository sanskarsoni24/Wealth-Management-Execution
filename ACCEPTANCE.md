# ACCEPTANCE — the 10-point checklist with exact click-paths

Each item from `mock-backend.md` mapped to the precise steps that prove it. Open the app at
`http://localhost:5173`. The **dev panel** is **Ctrl + Shift + D** — used to fast-forward the
rail's deliberate delays and force branch outcomes.

> Tip: in the dev panel set **timeScale → 20× fast** to run the multi-second waits almost
> instantly, or use **Fast-forward all pending** to jump any wait to its terminal state.

---

### 1. All five seeded KYC personas drive visibly different onboarding branches
1. `/` → **Get started** → enter mobile `9876543210` and each PAN below → **Continue** → OTP `123456` → **Verify**.
2. Observe the distinct branch per PAN:
   - `BBBPB2222B` → **NOT_FOUND** → "Quick one-time verification" → e-KYC (Aadhaar + selfie).
   - `CCCPC3333C` → **INCOMPLETE** → same e-KYC but "Looks like we need a fresh, quick check" (no blame).
   - `DDDPD4444D` → **ON_HOLD** → "A quick manual review is needed" dead-end + **Talk to support**.
   - `EEEPE5555E` → **SERVICE_DOWN** → "This is taking a little longer than usual" soft retry.
   - `AAAPA1111A` → **VERIFIED + account exists** → straight to Home (see #2).

### 2. The returning user (`AAAPA1111A`) skips gates 2–3 entirely
1. Enter `AAAPA1111A` + mobile → OTP → **Verify**.
2. Lands directly on **Home** with an existing holding — **no** account-setup, bank, or auto-pay screens shown.
3. Invest path is fund → amount → review → pay → order (gates 2–3 never appear).

### 3. A SIP set up before mandate approval shows AWAITING, then flips to ACTIVE with a real first-debit date
1. As `AAAPA1111A` (or any onboarded user) → Home → a holding → … or from an allotment, tap **Set up a monthly SIP**. (Quickest: Home → **Invest** → complete a purchase → on allotment tap **Make this automatic**.)
2. SIP setup: amount `5000`, pick a date → **Continue** → auto-pay limit (keep default) → **Allow auto-pay**.
3. **SIP confirmed** shows **"Your SIP is set 🎉 · Auto-pay: waiting for bank approval"** (AWAITING_MANDATE).
4. Wait ~8s (or dev panel **Fast-forward** / force **Mandate → APPROVED**).
5. Screen flips to **"Auto-pay approved — your SIP is live"** with a concrete **first debit** date (and "this cycle vs next" stated explicitly).

### 4. `EXCEEDS_MANDATE` is reachable and offers raising the limit
1. In SIP setup use amount `5000` → **Continue**.
2. On the auto-pay screen, set the **limit to `2000`** (below the SIP amount) → **Allow auto-pay**.
3. Banner: **"Your ₹5,000 SIP is above your current auto-pay limit of ₹2,000."** with **Raise my limit**.
4. (Step-up variant) Home → tap a live SIP → **Increase amount** → enter an amount above the ceiling → **Apply** → "This step-up would exceed your auto-pay limit" + **Raise my limit**.

### 5. A purchase shows three distinct truths over time — received → accepted → allotted, never collapsed
1. Home → **Invest** (Prudent Bluechip) → amount `5000` → **Invest** → **Review** → **Invest ₹5,000**.
2. **Order** screen shows a 3-step tracker: **Request received** ✓ → **Confirmed with the exchange** (blue, NOT green) → **Units in your account** (still open).
3. Tap **Open UPI app & approve** → after payment the tracker shows the **money-in-units-pending gap** (teal, dated), then ~15s later (or dev **Fast-forward**) the **green** success appears ONLY at step 3.

### 6. The cutoff countdown changes the NAV-date copy before vs after the cutoff hour
1. On **Enter amount** or **Review**, see the live line: **"Invest by 3:00 PM for today's price · Xh Ym left."**
2. Dev panel → **Jump NAV cutoff → After**. The copy flips to **"It's past 3:00 PM, so you'll get [next market day]'s price."** and the order prices on the next business day.
3. Switch back to **Before** to restore today's-price copy. (Weekends/holidays show the *effective* date.)

### 7. All five UPI states render — including EXPIRED (let it time out) and debited-but-failed
On the **Payment** screen (after placing an order and tapping Pay):
- **PENDING** — the default: "Approve the … request · m:ss left", do-not-close guidance, live timer.
- **SUCCESS** — tap **Open UPI app & approve** → "Payment received" → advances to the units-pending gap.
- **EXPIRED** — **don't approve**; let the timer hit 0 (dev panel **20× fast** or **Fast-forward**) → "The request timed out. No money was taken — try again."
- **REJECTED** — dev panel **Payment → REJECTED** → "Looks like you declined the request."
- **FAILED** — dev panel **Payment → FAILED** → "That didn't go through. Try another UPI app or method."
- **DEBITED-BUT-FAILED** (worst case) — dev panel **Payment → DEBITED_BUT_FAILED** → "Your money is safe" reconciliation state with the 5-working-day SLA + **Track this / Talk to our team**. Never a dead "failed" screen.

### 8. The money-in-units-pending gap is a designed, reassuring, dated screen — not a spinner
1. Complete a payment (SUCCESS) in the purchase flow.
2. The order screen shows **"Payment received — your money is safely with us"** with a dated timeline
   (**Received ✓ · Buying your units… · Expected by [date]**) and "we'll notify you" — no bare spinner.

### 9. Double-submitting an order with the same idempotency key does not create two orders
1. On **Review**, the **Invest** button **locks** the instant it's tapped (shows "Placing your order… don't close the app"), so a double-tap can't fire twice.
2. Under the hood, the confirm action carries ONE idempotency key; re-sending it returns the **same** order. The rail's live log (dev panel) shows a single `order -→ACCEPTED` transition. (The "We didn't get a clear confirmation — we won't place this twice" copy covers the network-drop case.)

### 10. Every failure path lands on a specific recovery — never a generic "something went wrong"
Spot-check the specific recoveries (each is distinct copy + a real next step):
- Invalid PAN → inline "That doesn't look like a valid PAN". Service down → soft retry.
- e-KYC OTP `000000` → "That code didn't work — let's try again", progress saved.
- Selfie poor light (button) → "We couldn't get a clear read"; after 2 tries → "verify another way".
- Bank `0000000000` → "The name on this account doesn't match your PAN."; IFSC `XXXX…` → unsupported (auto-pay).
- Order: dev **Order → REJECTED** after payment → honest reversal + refund-in-2–3-days.
- Redemption: ELSS holding (locked) → "Locked until 12 Sep 2026"; exit-load disclosure before confirm; dev **Order → REJECTED** on a redeem → "Your bank returned the payout — confirm details and we'll resend."
- SIP: mandate **REJECTED/UNSUPPORTED_BANK** → "Your bank didn't approve auto-pay…"; failed instalment → "We'll retry … no penalty."

> Verification that no rail vocabulary leaks into the UI:
> `grep -rniE "\b(UCC|EUIN|UMRN|folio|NACH|TRXN|client_code|scheme_code)\b" src/app` → no rendered hits.
