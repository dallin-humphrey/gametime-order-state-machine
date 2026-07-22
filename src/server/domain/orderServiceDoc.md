# OrderService (orchestrator)

## Overview

The composition point for the pure state machine, the payment gateway, and the repository. Every request to advance an order flows through `advance()`. This file is where the four failure recoveries from the assessment are actually enforced.

**Location:** `src/server/domain/orderService.ts`

## Why this file exists

The pure state machine says *which* transitions are legal. The gateway executes payments. The repo persists. None of them decide the *recovery* on a payment failure — that decision is here:

- authorize declined → drive to `rejected`
- complete failed, void succeeded → drive to `cancelled`
- complete failed, void failed → drive to `needs_attention` and populate `voidError` (loud)
- manual resolve on `needs_attention` → drive to `cancelled` and clear `voidError`

Concentrating this logic in one class means the four recoveries fit on one screen. A reviewer reads `advance` top-to-bottom and sees the entire failure story.

## Key decisions

### Only one write path: `advance`

`create`, `get`, `list`, `advance`. That's the entire public surface. There's no `markAsX()` helper, no `forceState()` — every state change goes through `advance`, which routes to the appropriate private handler, which routes through `commit()`, which routes through `applyTransition()`. Bypass is impossible.

### `simulateCompletionFailure` / `simulateVoidFailure` on `AdvanceInput`, NOT on `AdvanceEvent`

```ts
type AdvanceInput = {
  orderId: OrderId;
  event: AdvanceEvent;
  simulateCompletionFailure?: boolean;
  simulateVoidFailure?: boolean;
};
```

The simulation flags trigger the completion-failure and void-failure paths from tests and the UI. They live on `AdvanceInput` (the request wrapper) rather than on `AdvanceEvent` (the domain event) because they're *how* we process the event, not *what* the event is. The `AdvanceEvent` union stays event-log-clean — you could persist and replay it without simulation noise.

### Discriminated-union `switch` on `event.type`

```ts
switch (input.event.type) {
  case "authorize_payment": return this.authorize(...);
  case "complete_order":    return this.complete(...);
  case "resolve_manual":    return this.resolveManual(...);
  default: return assertNever(input.event);
}
```

Adding a new event without a case here becomes a compile error, because `assertNever` refuses any value that isn't `never`.

### `commit()` — the single write helper

Every private handler calls `commit(order, toState, eventType, metadata, extra?)`. `commit()`:

1. Calls `applyTransition(from, to)` — throws if illegal.
2. Constructs the `OrderHistoryEntry` inline (correct `fromState`, timestamps).
3. Calls `repo.update(id, ...)`.

Zero code path exists that touches the repo without going through `applyTransition` first.

### Throwing on illegal transitions, not Result

`applyTransition` returns a `Result`, but the service throws when the transition is illegal. Reason: hitting the service with an illegal move means the API layer failed to guard, or the state changed under us during a concurrent request. Either way, that's a *bug*, not a domain event — and bugs should crash the request, not be wrapped in a Result.

### `voidError` field on Order + `metadata.voidError` in history

Both. The `Order.voidError` field is what the UI reads to render the loud red badge on `needs_attention`. The `history[].metadata.voidError` is the audit trail — what specifically failed and when. Redundant but each has a different consumer, and the assessment's "don't silently swallow" rule warrants belt-and-suspenders here.

### `describeError` locally, not exported

Only used inside `complete` to stringify a `PaymentError` for the field-level `voidError`. Kept private so it's not accidentally reused for other purposes (the history metadata keeps the structured error, not the stringified version).

## Public surface

| Method | Purpose |
|---|---|
| `create({ amountCents })` | New order in `initialized`. First history row inserted by the repo. |
| `get(id)` | Lookup or null. |
| `list(limit?)` | Recent orders. |
| `advance(input)` | The only mutation. Routes to the right private handler by `input.event.type`. |

## Related files

- [`../domain/orderStateDoc.md`](./orderStateDoc.md) — the pure state machine we consume.
- [`../payments/paymentGatewayDoc.md`](../payments/paymentGatewayDoc.md) — the gateway interface.
- [`../repositories/orderRepositoryDoc.md`](../repositories/orderRepositoryDoc.md) — persistence.
- [`../../../tests/orderService.test.ts`](../../../tests/orderService.test.ts) — the four required scenarios end-to-end.

## Testing notes

`tests/orderService.test.ts` covers:

1. **Happy path** — `create → authorize → complete`, 3 history rows.
2. **Payment decline** — authorize returns `err({ kind: "declined" })` → state `rejected`, `metadata.paymentError` captured, no `paymentIntentId`.
3. **Completion failure with successful void** — `simulateCompletionFailure: true`, gateway.voidPayment returns ok → state `cancelled`, `metadata.completionError` and `metadata.voidedAt` both set.
4. **Completion failure with failed void** — both simulate flags true → state `needs_attention`, `Order.voidError` populated, `metadata.completionError` and `metadata.voidError` both captured, gateway was NOT called (simulated).
5. **Manual resolve** — `needs_attention → cancelled`, `voidError` cleared.
6. **Advancing a terminal state throws** — attempting `advance` on a `rejected` order throws "illegal transition."
7. **Advancing an unknown id throws.**
8. **`list()` sorts most-recent-first.**
