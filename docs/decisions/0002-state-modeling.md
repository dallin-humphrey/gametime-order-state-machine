# ADR 0002 — State Modeling: Pure Module vs XState

**Status:** Accepted
**Date:** 2026-07-22
**Related plan:** `docs/plans/order-state-machine-plan.md` §4 (Domain Model), §8 (State Machine Design)

## Context

The assessment centers on a state machine. TypeScript has several ways to express one:

1. **Pure module** — a `readonly` transition matrix + a small pure `applyTransition(from, to)` function returning a `Result`.
2. **XState** — a well-known FSM/statechart library.
3. **Class with methods per transition** — imperative, mutation-heavy.

## Decision

**Option 1 — a pure module.** Concretely:

```ts
export const orderStates = [...] as const;
export type OrderState = typeof orderStates[number];

export const transitions = {
  initialized:        ["payment_authorized", "rejected"],
  payment_authorized: ["complete", "cancelled", "needs_attention"],
  // ...
} as const satisfies Record<OrderState, readonly OrderState[]>;

export function applyTransition(
  from: OrderState,
  to: OrderState,
): Result<OrderState, "invalid_transition"> { ... }
```

## Consequences

**Positive:**
- **Total transparency.** The interviewer reads the transition matrix in one look. Nothing is hidden inside a library.
- **Free exhaustiveness.** `as const satisfies Record<OrderState, ...>` makes it a compile error to add a state without listing its allowed successors.
- **Zero dependencies for the core.** `orderState.ts` imports *nothing*. It's trivially unit-testable and has no framework contact.
- **100% branch coverage is cheap.** ~30 lines of code, ~10 tests.
- **Reads like a spec.** The transitions object *is* the specification.

**Negative:**
- No visualizer out of the box (XState has one). Mitigated by the ASCII diagram in the plan doc.
- Nested/hierarchical state machines would need more code. Not needed here.

## Alternatives Considered

| Option | Why not |
|---|---|
| XState | The state model is small enough that the library obscures it more than it helps. Panel round 1 extension is harder to reason about with a library in the way. |
| Class with imperative transition methods | Trades type-level guarantees for runtime discipline; a subtle bug in a method could bypass invariants. The pure-function approach makes bypass impossible. |
