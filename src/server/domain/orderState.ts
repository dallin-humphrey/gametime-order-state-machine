/**
 * Pure state machine for the order lifecycle.
 *
 * This module imports NOTHING from the DB, HTTP, React, or any framework —
 * only from `./types`. It is the specification of "given the current state,
 * is this next state legal?". Every write in `OrderService` is preceded by
 * a call to `applyTransition`; illegal moves are refused before any I/O.
 *
 * Why not a state-machine library (XState): 6 states + 7 legal transitions
 * fit on one screen. Making the model visible is more valuable than hiding
 * it behind a library. The `transitions` object below IS the specification.
 */
import type { OrderState, Result, TransitionError } from "./types";
import { err, ok } from "./types";

/**
 * The transition matrix — the single source of truth for legality.
 *
 * Three type-level tricks working together:
 *   - `as const` keeps every string a literal, so
 *     `transitions.initialized[0]` narrows to `"payment_authorized"`
 *     (not `string`).
 *   - `satisfies Record<OrderState, readonly OrderState[]>` proves at
 *     compile time that every state is covered, WITHOUT widening the
 *     value's inferred literal type (which a plain `: Record<...>`
 *     annotation would do).
 *   - Adding a new state to `OrderState` in types.ts becomes a compile
 *     error here until its successors are listed. The schema is
 *     self-defending.
 */
export const transitions = {
  initialized: ["payment_authorized", "rejected"],
  payment_authorized: ["complete", "cancelled", "needs_attention"],
  complete: [],
  rejected: [],
  cancelled: [],
  needs_attention: ["cancelled"],
} as const satisfies Record<OrderState, readonly OrderState[]>;

/**
 * Attempt to transition. Returns `ok(next)` on success, `err("invalid_transition")`
 * on any illegal move (including "from a terminal state", which is just a
 * special case — terminal states have empty successor arrays).
 *
 * NEVER throws. The caller decides how to react (log, return a 409, drop it).
 */
export function applyTransition(
  from: OrderState,
  to: OrderState,
): Result<OrderState, TransitionError> {
  const allowed: readonly OrderState[] = transitions[from];
  if (!allowed.includes(to)) {
    return err("invalid_transition");
  }
  return ok(to);
}

/**
 * The states that could legally follow `from`. Used by the UI to render only
 * the advance buttons that would succeed.
 */
export function nextStates(from: OrderState): readonly OrderState[] {
  return transitions[from];
}

/**
 * A state is terminal if no successors exist. `needs_attention` has one
 * successor (`cancelled` via manual resolution), so `isTerminal("needs_attention")`
 * is false — that's deliberate, otherwise the UI would hide the resolve button.
 */
export function isTerminal(state: OrderState): boolean {
  return transitions[state].length === 0;
}
