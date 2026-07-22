# gametime-order-state-machine

A small service that models the order lifecycle for a ticket-marketplace checkout, with **stage-dependent failure recovery**. Built for Gametime's Senior / Staff Fullstack Engineer take-home.

---

## TL;DR

- **Happy path:** `initialized → payment_authorized → complete`
- **Payment declined** during authorization → order is `rejected` (no cleanup)
- **Completion fails** after authorization, void succeeds → order is `cancelled`
- **Completion fails, void fails** → order is `needs_attention` and the void error is surfaced (no silent swallow)
- **Manual resolve** on `needs_attention` → `cancelled`

The four required test scenarios from the assessment live in [`tests/orderService.test.ts`](./tests/orderService.test.ts) — see the "Where to find the required tests" section below.

**Repo:** `github.com/dallin-humphrey/gametime-order-state-machine`
**Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Zod v4 · Jest

---

## What I built & why

**The core deliverable** is a pure, in-process state machine (`src/server/domain/orderState.ts`) with exhaustive Jest coverage. Every legal transition is expressed in one const object (`transitions`); every write anywhere else in the app runs through a single `applyTransition` call first, so illegal moves cannot be persisted.

**Around that core**, I wired:
- a `PaymentGateway` interface with a scriptable stub for tests and a deterministic demo gateway for the running app;
- an `InMemoryOrderRepository` (per the assessment's "in-memory is fine");
- an `OrderService` orchestrator that owns the four failure recoveries;
- four Next.js Route Handlers exposing the "small API" the assessment asks for;
- a 2-page UI (list + detail with advance buttons) so the whole thing can be walked through in a browser.

**Why this shape (not a single `index.ts`):** the assessment budgets ~3 hours, and I intentionally spent more. The reason is the panel loop that follows — round 1 is an *"extend the take-home live with AI"* session, and I wanted a repo I actually operate in every day. The tradeoff is called out honestly in the [Tradeoffs](#tradeoffs) section below. The core deliverable is still readable in isolation: `orderState.ts` + `orderService.ts` + `tests/orderState.test.ts` + `tests/orderService.test.ts` cover the entire assessment on their own.

---

## Quick tour

```
src/
├── app/                                    # Next.js App Router — UI + Route Handlers
│   ├── page.tsx                            # Orders list (RSC)
│   ├── layout.tsx
│   ├── globals.css                         # Tailwind v4 @theme brand tokens
│   ├── components/                         # StateBadge, OrderCard, NewOrderButton
│   ├── orders/[orderId]/
│   │   ├── page.tsx                        # Detail (RSC, thin)
│   │   └── components/                     # OrderDetailContent, StateHistoryTable, AdvanceControls
│   └── api/orders/                         # Route Handlers
│       ├── route.ts                        # GET list, POST create
│       ├── [orderId]/route.ts              # GET one
│       └── [orderId]/advance/route.ts      # POST advance (only mutation)
├── server/
│   ├── domain/
│   │   ├── types.ts                        # Branded IDs (z.brand), OrderState, AdvanceEvent, Result, PaymentError
│   │   ├── orderState.ts                   # ★ PURE state machine — the assessment's core
│   │   └── orderService.ts                 # Orchestrator — the 4 failure recoveries
│   ├── payments/
│   │   ├── paymentGateway.ts               # Interface
│   │   ├── stubPaymentGateway.ts           # Scriptable queues, for tests
│   │   └── demoPaymentGateway.ts           # Deterministic on inputs, for the running app
│   ├── repositories/
│   │   └── orderRepository.ts              # OrderRepository + InMemoryOrderRepository (globalThis Map)
│   └── api/
│       └── serviceInstance.ts              # Singleton OrderService for Route Handlers + RSC
├── tests/
│   ├── orderState.test.ts                  # 48 tests — transition matrix + branded schemas
│   ├── stubPaymentGateway.test.ts          # 10 tests — stub semantics
│   └── orderService.test.ts                # 11 describe blocks — the 4 REQUIRED scenarios + invariants
└── docs/
    ├── plans/order-state-machine-plan.md   # Full design doc (locked to Option B in §0)
    ├── decisions/                          # ADRs 0001–0003 (tech stack, state modeling, branded types)
    ├── features/                           # Feature-level master doc
    └── ai/AI_USAGE.md                      # AI use disclosure (per recruiter ask)
```

**Every code file has a sibling `NameDoc.md`** explaining *why* it looks the way it does. That's how I'll walk the interviewer through each decision — the docs are meant to read like plain-English annotations of the code.

---

## Running locally

```bash
git clone https://github.com/dallin-humphrey/gametime-order-state-machine.git
cd gametime-order-state-machine
npm install
npm run dev        # http://localhost:3000
```

**Other commands:**
```bash
npm test                   # Jest — runs all unit tests
npm run test:watch
npm run test:coverage
npm run typecheck          # tsc --noEmit
npm run build              # next build
npm run lint
```

No environment variables required. The `.env.example` explains why.

---

## Where to find the required tests

The assessment names four scenarios by name. Each lives in [`tests/orderService.test.ts`](./tests/orderService.test.ts):

| # | Scenario | `describe` block |
|---|---|---|
| 1 | Happy path | `OrderService — happy path` |
| 2 | Payment decline | `OrderService — payment decline` |
| 3 | Completion failure with successful void | `OrderService — completion failure, void succeeds` |
| 4 | Completion failure with failed void | `OrderService — completion failure, void fails` |

Beyond those four, `tests/orderState.test.ts` covers the pure transition matrix (48 tests, targeting 100% branch coverage), and `tests/stubPaymentGateway.test.ts` covers the scriptable stub's own semantics. Total: **69 tests, all passing.**

Run them:
```bash
npm test
```

---

## API surface

| Verb | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/api/orders?limit=N` | — | List most-recent-first; `limit` clamped `[1, 100]` |
| `POST` | `/api/orders` | `{ amountCents: number }` | Creates in `initialized`; returns 201 |
| `GET` | `/api/orders/:id` | — | Returns order + full history; 404 if missing |
| `POST` | `/api/orders/:id/advance` | `{ event: AdvanceEvent, paymentMethodToken?, simulateCompletionFailure?, simulateVoidFailure? }` | The only mutation. Zod-validated body. 409 on illegal transition, 404 on missing, 400 on bad input. |

All inputs are Zod-parsed at the boundary. Branded types (`OrderId`, `PaymentIntentId`, `AmountCents`) are produced only through their schemas — no `as` casts anywhere in the codebase.

---

## How it works (in one screen)

The transition matrix lives in [`src/server/domain/orderState.ts`](./src/server/domain/orderState.ts):

```ts
export const transitions = {
  initialized:        ["payment_authorized", "rejected"],
  payment_authorized: ["complete", "cancelled", "needs_attention"],
  complete:           [],
  rejected:           [],
  cancelled:          [],
  needs_attention:    ["cancelled"],
} as const satisfies Record<OrderState, readonly OrderState[]>;
```

`as const satisfies Record<OrderState, readonly OrderState[]>` is doing three things:
- keeping every string a *literal* so downstream code narrows on the exact successor,
- proving every `OrderState` is covered,
- turning "add a new state" into a compile error until the matrix is updated.

Every state change in `OrderService` runs through `applyTransition(from, to)` before the repo is touched. Illegal moves throw `IllegalTransitionError`, which the route handler translates to HTTP `409`.

**Failure recoveries** live in `OrderService.advance()`:

- **Authorize declined** → `commit(order, "rejected", ...)`, no cleanup.
- **Completion fails, void OK** → `commit(order, "cancelled", ...)` with `metadata.completionError` + `metadata.voidedAt` captured.
- **Completion fails, void fails** → `commit(order, "needs_attention", ...)` with both errors in `metadata` AND `Order.voidError` populated (loud red banner in the UI).
- **Manual resolve** → `commit(order, "cancelled", ...)`, clears `voidError`.

Completion failure and void failure are triggered via `simulateCompletionFailure` / `simulateVoidFailure` flags on the request. The UI surfaces them as clearly-labeled buttons ("Simulate: completion + void fail"). This is how the assessment's failure paths get demoed without a real fulfillment system.

For the full narrative, see [`docs/plans/order-state-machine-plan.md`](./docs/plans/order-state-machine-plan.md).

---

## Tradeoffs

### 1. I built more than the assessment asked for

The PDF says *"~3 hours, don't over-engineer."* I built Next.js + Route Handlers + Tailwind + a UI. That's more than the minimum.

**Why:** the panel loop that follows the assessment includes an *agentic-assisted-coding round* where I extend this repo live with AI. That works better in a codebase I operate in daily. The docs also serve me during the walkthrough — I can point at a `NameDoc.md` when asked "why did you do it this way?"

**Mitigation:** the core deliverable is still self-contained. A reviewer can read `orderState.ts` + `orderService.ts` + `tests/*.test.ts` in ~15 minutes and confirm the assessment was solved, without needing to understand any of the surrounding code. Everything on top of that is optional.

### 2. In-memory storage is truly ephemeral

State lives in a `globalThis`-attached `Map`. It survives Next.js HMR (dev) and warm serverless instances (Vercel) — but a cold Lambda start throws it away, and multi-instance deploys don't share state. That's fine for a demo; it's not production-grade.

### 3. Route handlers aren't unit-tested

The service is exhaustively tested (69 tests, including the 4 required scenarios). The Route Handlers are thin adapters (Zod parse → service call → HTTP mapping) — I chose to cover them via manual verification / the UI rather than write API-level tests. If I added Playwright or Cypress, the route handlers would get the first e2e specs.

### 4. Simulation flags on the wire

`simulateCompletionFailure` and `simulateVoidFailure` are opt-in booleans on the advance request. That's how the UI triggers the failure paths without an actual fulfillment system. In a real integration they'd be gone — replaced by the outcome of a real completion service.

### 5. `DemoPaymentGateway` is deterministic, not stochastic

For the running app, `authorize` inspects `paymentMethodToken` (`"decline"` → declines, anything else → succeeds). No random failures. A real payment provider would fail intermittently on network — we'd need retries and idempotency keys, which are out of scope.

---

## What I'd do with more time

Ordered roughly by ROI:

1. **Idempotency keys on `POST /api/orders/:id/advance`** — if the client retries a mutation, the second call should return the same result instead of attempting the transition again.
2. **A real payment adapter** — Stripe. The `PaymentGateway` interface is designed for it; only the impl changes.
3. **Persistent storage** — Postgres via Drizzle (I skipped it deliberately per assessment guidance; would be a ~1-day addition). Would also let us survive multi-instance deploys.
4. **Optimistic concurrency on `update`** — right now two simultaneous `advance` calls could race. Would use an `updated_at` timestamp or a version column and reject stale updates.
5. **Structured logging + OTel spans** — each `advance()` becomes a trace with the from/to state, event, and any `PaymentError` attached. Every state change becomes queryable.
6. **Retry policy for `void`** — the assessment says a failed void goes to `needs_attention`, but in prod we'd probably want an automatic retry with backoff before falling through to manual resolution.
7. **Webhook signature verification** for the payment provider's async void callbacks.
8. **A `SqlOrderRepository`** — same interface, Drizzle queries underneath. Would prove the interface abstraction was worth it.
9. **`resolve_manual` requires an operator note** — capturing *why* the operator resolved it manually would help post-incident analysis.
10. **Property-based tests** for the transition matrix using `fast-check` — generate random `(from, to)` pairs and assert `applyTransition` is monotonic + terminal states never advance.

---

## AI use

Per the recruiter's ask (Evan Tarkington, 2026-07-22): *"we ask that you document where and why you used [AI], and how you validated or challenged the outputs along the way."*

A curated log of the meaningful AI-assisted steps — what I asked, what came back, and how I validated — lives at [`docs/ai/AI_USAGE.md`](./docs/ai/AI_USAGE.md).

Short version: **AI (Claude Code, Opus 4.7) wrote nearly every line of code and doc**, guided by my architectural decisions (Matt Pocock-style TS, the doc format from my Squiresolutions repo, the "state machine as pure module" call, the tradeoff to build Next.js despite the "don't over-engineer" note). Validation was continuous — every phase ended with `npm run typecheck && npm test && npm run build`, and every non-obvious decision (`z.brand()` vs hand-rolled brand, `as const satisfies` vs plain annotation, error classes vs string-matching) was called out in an ADR or `NameDoc.md`. Two AI mistakes were caught and fixed mid-build (`PaymentError` imported from the wrong file; `list()` race on same-millisecond timestamps).

---

## Docs deep dive

If you want the full narrative rather than the compressed README version:

- [`docs/plans/order-state-machine-plan.md`](./docs/plans/order-state-machine-plan.md) — the master design doc (18 sections; §0 locks scope to what actually shipped).
- [`docs/features/orderStateMachineMasterDoc.md`](./docs/features/orderStateMachineMasterDoc.md) — feature-level walkthrough tying the code together.
- [`docs/decisions/0001-tech-stack.md`](./docs/decisions/0001-tech-stack.md) — why Next.js + Zod + Jest and not alternatives.
- [`docs/decisions/0002-state-modeling.md`](./docs/decisions/0002-state-modeling.md) — why a pure module and not XState.
- [`docs/decisions/0003-branded-types-and-result.md`](./docs/decisions/0003-branded-types-and-result.md) — why `z.brand()` + `Result<T, E>`.

Every code file has a sibling `NameDoc.md` — e.g. [`src/server/domain/orderStateDoc.md`](./src/server/domain/orderStateDoc.md), [`src/server/domain/orderServiceDoc.md`](./src/server/domain/orderServiceDoc.md), [`src/app/orders/%5BorderId%5D/components/AdvanceControlsDoc.md`](./src/app/orders/[orderId]/components/AdvanceControlsDoc.md), etc. Each doc explains *why* the file exists and every non-obvious decision inside it, in plain English.

---

Built with the tradeoff explicitly acknowledged. Happy to walk through any of this live.
