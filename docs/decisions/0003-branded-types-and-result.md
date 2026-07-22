# ADR 0003 — Branded Types + `Result<T, E>` for Failure Modeling

**Status:** Accepted
**Date:** 2026-07-22
**Related plan:** `docs/plans/order-state-machine-plan.md` §4.4 (Branded types), §4.6 (Result type), §11 (TS best practices)

## Context

Two type-level questions were interlinked:

1. **How do we prevent an ID mixup?** In this domain we have `OrderId` and `PaymentIntentId`. Both are strings underneath. Nothing at the type level stops a caller from passing one where the other is expected.

2. **How do we represent domain-meaningful failures?** Payments can be declined, void can fail — the whole point of the assessment is *not* silently swallowing these. Do we throw? Return `null`? Return a tagged union?

## Decision

### Branded types via Zod

```ts
export const orderIdSchema = z.string().uuid().brand("OrderId");
export type OrderId = z.infer<typeof orderIdSchema>;
```

The `.brand("OrderId")` phantom tag makes `OrderId` and `PaymentIntentId` distinct at the type level even though both are `string` at runtime. Zod is the source of truth: the same schema that produces the branded type is used at the API boundary to validate incoming values.

### `Result<T, E>` for domain-meaningful failures

```ts
export type Result<T, E> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

export type PaymentError =
  | { kind: "declined";       reason: string }
  | { kind: "network_error";  cause: unknown }
  | { kind: "provider_error"; message: string };
```

The `PaymentGateway.authorize()` method returns `Result<PaymentAuthorization, PaymentError>`. `OrderService.advance()` handles each `PaymentError` kind by driving the state machine to the appropriate terminal state (rejected / cancelled / needs_attention).

Exceptions are reserved for programmer errors (invalid transitions, ID parse failures) — those *should* crash the request because they indicate a bug.

## Consequences

**Positive:**
- **Compiler catches ID mixups.** `authorize(payment_intent_id, order_id)` in the wrong order → TS error.
- **The state machine cannot silently swallow.** Every failure branch must be handled — the discriminated `PaymentError` union forces exhaustive `switch` cases via `assertNever`.
- **Boundary validation is free.** The Zod schema that produces the branded type is the same one used to parse Route Handler input.
- **The distinction between "domain-meaningful failure" and "programmer error" is legible in code review.** `Result` = expected failure path. Thrown exception = bug.

**Negative:**
- Slight verbosity at consumer sites (`result.ok ? result.value : result.error`). Mitigated by naming and by keeping `Result` local to service/repo boundaries — UI code sees the terminal state, not the `Result`.
- Branded types are invisible at runtime, so if someone bypasses the parser and hand-constructs an `OrderId`, the compiler won't catch it. Mitigated by only ever creating branded values through `.parse()`.

## Alternatives Considered

| Option | Why not |
|---|---|
| Plain `string` for IDs | No compile-time distinctness; a typo-swap of arguments compiles cleanly. |
| Hand-rolled `Brand<K, T>` | Works but duplicates Zod's job. Zod gives us runtime + type together. |
| Throw exceptions for declines | Loses the "different failures need different recoveries" story. A thrown `Error` at the service boundary is a smell; a returned `Result<T, PaymentError>` is a design. |
| `neverthrow` library | Nice API but pulling a dep for a 12-line type is unjustified in a project this size. |
