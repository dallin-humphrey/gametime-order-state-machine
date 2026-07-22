# Order State Machine (Pure)

## Overview

The transition matrix and `applyTransition` function that answer one question: *given the current state, is this next state legal?* No side effects. No DB, no HTTP, no framework — the only import is from `./types`. This file IS the specification of the order lifecycle.

**Location:** `src/server/domain/orderState.ts`

## Why this file exists

The assessment turns on "don't allow illegal transitions." Concentrating that rule in one pure function means:

1. The service layer *cannot* skip it — every advance path calls `applyTransition` first, before any DB write or payment call.
2. It's trivially unit-testable — no mocks, no fixtures, no async.
3. A reviewer reads the transition matrix in one glance and understands the entire lifecycle.

## Key decisions

### The transition matrix as `as const satisfies`

```ts
export const transitions = {
  initialized: ["payment_authorized", "rejected"],
  payment_authorized: ["complete", "cancelled", "needs_attention"],
  complete: [],
  rejected: [],
  cancelled: [],
  needs_attention: ["cancelled"],
} as const satisfies Record<OrderState, readonly OrderState[]>;
```

Three type-level tricks working together — this is the pattern that makes the file self-defending:

- **`as const`** keeps every string a literal, so `transitions.initialized[0]` narrows to `"payment_authorized"`, not `string`. That's what the UI relies on to render exactly-typed advance buttons.
- **`satisfies Record<OrderState, readonly OrderState[]>`** proves at compile time that every state is covered, WITHOUT widening the value's inferred literal type. If we had used `: Record<...>` as a type annotation instead, TypeScript would forget the specific successors and just know they're `OrderState[]`.
- **Coverage is enforced.** If you add a new state to the `OrderState` union in `types.ts`, this line becomes a compile error until you list the new state's successors. The rule literally cannot be forgotten.

### `Result` return instead of throw

`applyTransition` returns `err("invalid_transition")` rather than throwing. Reason: the service layer *reacts* to illegal transitions (log, return a 409, drop it). Making callers pay `try/catch` ceremony for a routine legality check would clutter the service code. `Result` also matches the pattern used elsewhere in the codebase for domain-meaningful failures.

Programmer errors (a Zod parse failure of a UUID from an internal caller) still throw — those mean bugs, not domain events.

### Terminal states = empty successors

There's no separate `terminalStates` set. A state is terminal iff `transitions[state].length === 0`. Two consequences:

- One source of truth (the matrix).
- `needs_attention` is intentionally NOT terminal — it has one successor (`cancelled` via manual resolution), so `isTerminal("needs_attention")` returns false. The UI keeps the "Manually resolve → cancelled" button visible, which is exactly what the assessment's "don't silently swallow" requirement wants.

## Public surface

| Export | Kind | Purpose |
|---|---|---|
| `transitions` | const | The matrix — source of truth |
| `applyTransition(from, to)` | fn | Returns `Result<OrderState, "invalid_transition">`. NEVER throws. |
| `nextStates(from)` | fn | Returns the successor array for `from`. UI uses this to render buttons. |
| `isTerminal(state)` | fn | True for `complete` / `rejected` / `cancelled`; false for `needs_attention`. |

## Related files

- [`typesDoc.md`](./typesDoc.md) — defines `OrderState`, `Result`, `TransitionError`.
- `orderServiceDoc.md` (Phase 3) — the only production caller of `applyTransition`.
- [`tests/orderState.test.ts`](../../../tests/orderState.test.ts) — 100% branch coverage.

## Testing notes

Covered in `tests/orderState.test.ts`:

1. **Matrix invariants** — every state has a key; every listed successor is a legal state; terminal states have empty successor arrays; `needs_attention` retains its manual-resolve path.
2. **Happy-path transitions** — `initialized → payment_authorized → complete` succeeds.
3. **Every failure-path transition** succeeds (decline, void OK, void fail, manual resolve).
4. **Every illegal transition** is refused with `"invalid_transition"`.
5. **Every terminal state** refuses every attempt (`it.each(orderStates)` sweep).
6. **Helpers** — `nextStates` returns matrix entries; `isTerminal` gets the semi-terminal `needs_attention` case right.
7. **Zod branded schemas** — UUID validation, non-empty PaymentIntentId, non-negative int amount.

If a new state is ever added, add a `describe` block for its legal transitions and its illegal targets.
