# Order State Machine — Feature Master Doc

> **Status:** Shipped
> **Date:** 2026-07-22
> **Related plan:** [`../plans/order-state-machine-plan.md`](../plans/order-state-machine-plan.md)
> **Related ADRs:** [0001-tech-stack](../decisions/0001-tech-stack.md), [0002-state-modeling](../decisions/0002-state-modeling.md), [0003-branded-types-and-result](../decisions/0003-branded-types-and-result.md)

## Overview

This is the top-level narrative for the feature — how the assessment's problem maps to the code, and where to find every piece. Every code file linked below has its own `NameDoc.md` explaining the *why* of that file specifically; this doc explains how they fit together.

---

## The problem (paraphrased from the assessment PDF)

An order goes through `initialized → payment_authorized → complete`. Each step can fail:

- **Payment declined** during authorization → reject the order (no cleanup).
- **Completion fails** after payment was authorized → void the payment, mark cancelled.
- **Void also fails** → move to `needs_attention` for manual resolution (do NOT silently swallow).

Model the state machine, enforce valid transitions, record history with timestamps, stub the payment gateway, expose a small API, cover the four scenarios above with tests.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  UI (Next.js App Router — src/app/**)                                        │
│  Server components read the service directly; one client component per       │
│  interactive surface (NewOrderButton, AdvanceControls).                      │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ POST /api/orders/[id]/advance (fetch)
┌──────────────────────────────▼───────────────────────────────────────────────┐
│  API layer — Route Handlers (src/app/api/orders/**)                          │
│  Zod-parsed inputs, branded IDs, translates errors → HTTP status.            │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────────────┐
│  Service — OrderService.advance()                                            │
│  src/server/domain/orderService.ts                                           │
│  The composition point. Owns the four failure recoveries. Every write        │
│  runs through commit() → applyTransition() before touching the repo.         │
└─────┬────────────────────┬────────────────────────────────┬──────────────────┘
      │                    │                                │
      ▼                    ▼                                ▼
┌──────────────┐   ┌──────────────────────┐   ┌──────────────────────────────┐
│ Pure state   │   │ PaymentGateway       │   │ InMemoryOrderRepository      │
│ machine      │   │ (interface + Stub    │   │ (globalThis-attached Map,    │
│ orderState.ts│   │  + Demo impls)       │   │  survives HMR + warm λ)      │
└──────────────┘   └──────────────────────┘   └──────────────────────────────┘
```

Rule of dependencies: arrows point *up* toward pure code. `orderState.ts` imports nothing from the DB, HTTP, or React.

---

## The five sub-features

### 1. Pure state machine

**Files:**
- [`src/server/domain/types.ts`](../../src/server/domain/types.ts) · [doc](../../src/server/domain/typesDoc.md)
- [`src/server/domain/orderState.ts`](../../src/server/domain/orderState.ts) · [doc](../../src/server/domain/orderStateDoc.md)

The transition matrix is a single `as const satisfies Record<OrderState, readonly OrderState[]>` object. `applyTransition(from, to)` returns `Result<OrderState, "invalid_transition">` — never throws. `nextStates(state)` and `isTerminal(state)` are cheap helpers.

Adding a new state = editing `orderStates` in `types.ts` → compile error in `orderState.ts` until the new key is added to `transitions` → compile error in `StateBadge.tsx` until the new key is added to the styles + labels tables. The type system enforces coverage.

**Tests:** [`tests/orderState.test.ts`](../../tests/orderState.test.ts) — 48 tests. 100% branch coverage target.

### 2. Payment gateway

**Files:**
- [`src/server/payments/paymentGateway.ts`](../../src/server/payments/paymentGateway.ts) · [doc](../../src/server/payments/paymentGatewayDoc.md)
- [`src/server/payments/stubPaymentGateway.ts`](../../src/server/payments/stubPaymentGateway.ts) · [doc](../../src/server/payments/stubPaymentGatewayDoc.md)
- [`src/server/payments/demoPaymentGateway.ts`](../../src/server/payments/demoPaymentGateway.ts) · [doc](../../src/server/payments/demoPaymentGatewayDoc.md)

Interface: two async methods returning `Result<T, PaymentError>`. Declines are NEVER thrown — the whole assessment turns on distinguishing decline / network / provider failures, and `Result` makes that distinction structural.

- `StubPaymentGateway` — scriptable FIFO queues for tests. Empty queue = throws (test-authoring bug, not a domain event).
- `DemoPaymentGateway` — deterministic on inputs for the running app. `authorize` inspects `paymentMethodToken` (`"decline"` → declines). `voidPayment` always succeeds; void failure is triggered at service level via `simulateVoidFailure`.

**Tests:** [`tests/stubPaymentGateway.test.ts`](../../tests/stubPaymentGateway.test.ts) — 10 tests.

### 3. Order repository

**Files:**
- [`src/server/repositories/orderRepository.ts`](../../src/server/repositories/orderRepository.ts) · [doc](../../src/server/repositories/orderRepositoryDoc.md)

`OrderRepository` interface + `InMemoryOrderRepository` — a `Map<OrderId, Order>` attached to `globalThis`. `list()` uses reversed Map iteration (spec-guaranteed insertion order) instead of `createdAt` sort to avoid ties on same-millisecond creates.

Tests inject their own `new Map()` via the constructor for isolation. The default constructor grabs the global instance.

### 4. Order service (orchestrator)

**Files:**
- [`src/server/domain/orderService.ts`](../../src/server/domain/orderService.ts) · [doc](../../src/server/domain/orderServiceDoc.md)

Public surface: `create`, `get`, `list`, `advance`. That's it. Every state change flows through the private `commit()` helper, which calls `applyTransition()` first. No bypass.

The four failure recoveries live in `authorize()` and `complete()`:

- `authorize` returns `err({ kind: "declined", ... })` → `commit(order, "rejected", ...)`
- `complete` with `simulateCompletionFailure` and successful `voidPayment` → `commit(order, "cancelled", ...)` with the completion + void success in metadata
- `complete` with `simulateCompletionFailure` and failing void → `commit(order, "needs_attention", ...)` with both errors in metadata AND `Order.voidError` populated

Custom error classes (`OrderNotFoundError`, `IllegalTransitionError`) let the route handler map to precise HTTP codes without string-matching.

**Tests:** [`tests/orderService.test.ts`](../../tests/orderService.test.ts) — 11 `describe` blocks. The first four are the assessment's required scenarios.

### 5. HTTP API + UI

**Files:**
- Route Handlers: [`route.ts`](../../src/app/api/orders/route.ts) · [detail](../../src/app/api/orders/%5BorderId%5D/route.ts) · [advance](../../src/app/api/orders/%5BorderId%5D/advance/route.ts)
- Pages: [`page.tsx`](../../src/app/page.tsx) · [detail](../../src/app/orders/%5BorderId%5D/page.tsx)
- Components: `StateBadge` · `OrderCard` · `NewOrderButton` · `OrderDetailContent` · `StateHistoryTable` · `AdvanceControls`

Server components read the service directly (no fetch waterfall in the RSC). Only interactive surfaces (`NewOrderButton`, `AdvanceControls`) are client components. On mutation, they `router.refresh()` to re-render the RSC page against fresh data.

The UI intentionally surfaces the failure buttons with explicit labels — `"Simulate: completion + void fail"` — so an interviewer can walk each failure recovery in the browser.

---

## The four required scenarios — annotated

### Scenario 1: Happy path

```ts
create() → order.state === "initialized"
advance({ event: "authorize_payment" }) → order.state === "payment_authorized", paymentIntentId set
advance({ event: "complete_order" }) → order.state === "complete"
// history has 3 rows: created → payment_authorized → complete
```

Covered by `tests/orderService.test.ts` `describe("OrderService — happy path")`.

### Scenario 2: Payment decline

```ts
gateway.scriptAuthorize(err({ kind: "declined", reason: "insufficient_funds" }))
create() → order.state === "initialized"
advance({ event: "authorize_payment" })
  → applyTransition("initialized", "rejected") succeeds
  → order.state === "rejected"
  → paymentIntentId stays null
  → history[1].metadata.paymentError = { kind: "declined", reason: "insufficient_funds" }
```

Covered by `describe("OrderService — payment decline")`.

### Scenario 3: Completion failure with successful void

```ts
gateway.scriptAuthorize(ok({ paymentIntentId, ... }))
gateway.scriptVoid(ok({ voidedAt: ... }))
create() → advance(authorize) → payment_authorized
advance({ event: "complete_order", simulateCompletionFailure: true })
  → the service catches the "simulated completion failure"
  → calls gateway.voidPayment({ paymentIntentId }) — the real gateway call
  → void succeeds
  → applyTransition("payment_authorized", "cancelled") succeeds
  → history[2].metadata = { completionError: {...}, voidedAt: Date }
```

Covered by `describe("OrderService — completion failure, void succeeds")`.

### Scenario 4: Completion failure with failed void

```ts
gateway.scriptAuthorize(ok({ paymentIntentId, ... }))
create() → advance(authorize) → payment_authorized
advance({
  event: "complete_order",
  simulateCompletionFailure: true,
  simulateVoidFailure: true,
})
  → simulateVoidFailure short-circuits the gateway — no gateway.voidPayment call
  → order.state → "needs_attention"
  → order.voidError → "network_error: Simulated void failure"
  → history[2].metadata = { completionError: {...}, voidError: {...} }
  → gateway.voidCalls === [] (assertion in the test)
```

Covered by `describe("OrderService — completion failure, void fails")`.

---

## Extending — how to add a new state

Say Gametime wants a `refunded` state. Here's the diff:

1. **`src/server/domain/types.ts`** — add `"refunded"` to `orderStates`.
2. **`src/server/domain/orderState.ts`** — TypeScript will error until you list `refunded`'s successors in `transitions` and add `refunded` as a possible successor of some existing state (probably `complete`).
3. **`src/server/domain/orderService.ts`** — add an `AdvanceEvent` variant like `{ type: "refund" }` (`assertNever` will force this) and a handler.
4. **`src/app/components/StateBadge.tsx`** — TypeScript will error until `styles.refunded` and `labels.refunded` are defined.
5. **`src/app/orders/[orderId]/components/AdvanceControls.tsx`** — add UI options for `complete → refund`.
6. **`tests/orderState.test.ts`** + **`tests/orderService.test.ts`** — add `describe` blocks.

Every TS error above is a signpost — the type system tells you exactly where to touch.

---

## Related docs

- [`../plans/order-state-machine-plan.md`](../plans/order-state-machine-plan.md) — the design plan (locked to Option B; deeper Option C notes retained for panel round 2).
- [`../decisions/0001-tech-stack.md`](../decisions/0001-tech-stack.md) — why Next.js + Zod + Jest.
- [`../decisions/0002-state-modeling.md`](../decisions/0002-state-modeling.md) — why a pure module, not XState.
- [`../decisions/0003-branded-types-and-result.md`](../decisions/0003-branded-types-and-result.md) — why `z.brand()` + `Result<T, E>`.
- [`../ai/AI_USAGE.md`](../ai/AI_USAGE.md) — curated AI usage log.
