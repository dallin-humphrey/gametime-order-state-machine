# Order Domain Types

## Overview

Central declaration of every type the order lifecycle deals with — IDs, amounts, states, events, the `Order` aggregate, the `Result` container, and the `PaymentError` union. Every downstream file (state machine, service, repository, payment gateway, route handlers, UI) imports from here, so a change to the order model is a single edit.

**Location:** `src/server/domain/types.ts`

## Why this file exists

Every layer of the app needs to talk about the same shapes. Duplicating types across the state machine, the service, the repo, and the HTTP layer guarantees drift. Concentrating them here means:

1. There's one source of truth for what an `OrderState` is.
2. A branded ID declared once is a branded ID everywhere.
3. Adding a new order field (e.g. `customerId`) is a single edit.

## Key decisions

### Branded IDs via `z.brand<"Tag">()`

```ts
export const orderIdSchema = z.string().uuid().brand<"OrderId">();
export type OrderId = z.infer<typeof orderIdSchema>;
```

`OrderId` and `PaymentIntentId` are both `string` at runtime, but at the type level they're distinct. If we used plain `string`, then `authorize(orderId, paymentIntentId)` and `authorize(paymentIntentId, orderId)` would both typecheck — the compiler couldn't tell them apart. With brands:

- A caller can only obtain an `OrderId` by parsing a value through `orderIdSchema.parse(...)`, which validates the shape and applies the phantom brand tag.
- Argument-swap mistakes become compile errors.
- Zod is doing double duty — the same declaration produces the schema (runtime validation) *and* the type (compile-time distinctness). No hand-rolled `type Brand<K,T> = K & { readonly __brand: T }` needed.

**Alternatives considered:**
- Plain `string` — no distinctness, argument mixups compile.
- Hand-rolled brand type — works but duplicates what Zod does.
- Fully separate classes (`class OrderId {}`) — heavy for what's essentially a string.

### Literal state array + derived union

```ts
export const orderStates = ["initialized", ...] as const;
export type OrderState = (typeof orderStates)[number];
```

- `as const` freezes the array and marks every element as a literal (`"initialized"` not `string`).
- `(typeof orderStates)[number]` produces the union of literals — the `OrderState` type.
- Adding a new state = adding one string to the array. The type updates automatically.
- The runtime array is reused for iteration in tests and UI dropdowns — no separate list.

### Discriminated union for `AdvanceEvent`

```ts
export type AdvanceEvent =
  | { type: "authorize_payment" }
  | { type: "complete_order" }
  | { type: "resolve_manual" };
```

Every variant is tagged on the `type` field. In the service, a `switch (event.type)` narrows each branch automatically, and `default: assertNever(event)` catches any missed case at *compile* time. Adding a new event without handling it fails the build.

### `Result<T, E>` for domain failures

```ts
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

Used when the caller needs to react differently to different failures — the whole point of the assessment is *not* silently swallowing payment errors. `Result` makes the failure explicit and part of the type signature. If a caller forgets to check `.ok`, TypeScript can't discriminate `.value` from `.error`.

**Exceptions are reserved for programmer errors** (invalid transitions attempted from callers that should know better, Zod parse failures at internal call sites). Those *should* crash so the bug is visible.

### `assertNever` for exhaustiveness

```ts
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
```

If a discriminated-union `switch` misses a case, TypeScript types the fall-through as *that* variant instead of `never`, and `assertNever` fails to typecheck. This turns a missed case into a red squiggle rather than a silent runtime hole.

## Public surface

| Export | Kind | Purpose |
|---|---|---|
| `orderIdSchema` | Zod schema | Parses + brands an `OrderId` |
| `OrderId` | type | Branded UUID |
| `paymentIntentIdSchema` | Zod schema | Parses + brands a `PaymentIntentId` |
| `PaymentIntentId` | type | Branded non-empty string |
| `amountCentsSchema` | Zod schema | Non-negative integer amount |
| `AmountCents` | type | Branded number |
| `orderStates` | readonly array | Runtime list of every state literal |
| `OrderState` | type | Union of state literals |
| `AdvanceEvent` | type | Discriminated union of user-driven events |
| `OrderHistoryEntry` | type | Row shape for the order's history log |
| `Order` | type | Aggregate — current state + history |
| `Result<T, E>` | type | Tagged success/failure |
| `ok(v)` / `err(e)` | fn | `Result` constructors |
| `PaymentError` | type | Discriminated union of payment failures |
| `TransitionError` | type | Errors from `applyTransition` |
| `assertNever(x)` | fn | Compile-time exhaustive-check guard |

## Related files

- [`orderStateDoc.md`](./orderStateDoc.md) — the pure state machine consumes these types.
- `orderServiceDoc.md` (Phase 3) — the orchestrator threads `Result` through failure paths.
- `paymentGatewayDoc.md` (Phase 2) — declares `authorize`/`void` returning `Result<_, PaymentError>`.
- [`tests/orderState.test.ts`](../../../tests/orderState.test.ts) — exercises `orderStates` at runtime + Zod branded schemas.

## Testing notes

Types don't have direct tests, but every consumer file's tests exercise them. `tests/orderState.test.ts` includes explicit tests for the Zod branded schemas (UUID validation, non-negative int enforcement, etc.) so a Zod version bump that changes the API is caught immediately.
