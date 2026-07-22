/**
 * Domain types for the order state machine.
 *
 * Read top-to-bottom:
 *   1. Branded IDs and amounts   (compile-time distinct + runtime validated)
 *   2. State + Event types       (pure data model, no I/O)
 *   3. Order aggregate           (current state + history log)
 *   4. Result + PaymentError     (how domain failures are expressed)
 *
 * Nothing else in the app should re-declare these — every consumer imports
 * from here so a change to the order model is one edit, not many.
 */
import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// 1. Branded IDs and amounts
// ────────────────────────────────────────────────────────────────────────────

/**
 * A UUID that has been validated as an OrderId. `OrderId` and
 * `PaymentIntentId` are both `string` at runtime, but at the type level
 * they are distinct — mixing them up (`authorize(orderId, paymentId)` vs
 * `authorize(paymentId, orderId)`) becomes a compile error. That's the
 * whole point of `.brand()`.
 */
export const orderIdSchema = z.string().uuid().brand<"OrderId">();
export type OrderId = z.infer<typeof orderIdSchema>;

export const paymentIntentIdSchema = z
  .string()
  .min(1)
  .brand<"PaymentIntentId">();
export type PaymentIntentId = z.infer<typeof paymentIntentIdSchema>;

/**
 * Amounts are stored in cents so integer math avoids float rounding.
 * Non-negative int only.
 */
export const amountCentsSchema = z
  .number()
  .int()
  .nonnegative()
  .brand<"AmountCents">();
export type AmountCents = z.infer<typeof amountCentsSchema>;

// ────────────────────────────────────────────────────────────────────────────
// 2. State + Event types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Every legal state an order can hold.
 *
 * `as const` keeps each element as a literal type (`"initialized"` not
 * `string`), then `typeof orderStates[number]` derives the union. Adding a
 * new state = editing one array; the type updates automatically.
 *
 * The runtime array is also useful for iteration (tests, UI dropdowns).
 */
export const orderStates = [
  "initialized",
  "payment_authorized",
  "complete",
  "rejected",
  "cancelled",
  "needs_attention",
] as const;

export type OrderState = (typeof orderStates)[number];

/**
 * The events a caller can send to `OrderService.advance`. Discriminated
 * union tagged on `type` — a `switch (event.type)` in the service narrows
 * each branch automatically, and `default: assertNever(event)` catches any
 * missed case at compile time.
 */
export type AdvanceEvent =
  | { type: "authorize_payment" }
  | { type: "complete_order" }
  | { type: "resolve_manual" };

// ────────────────────────────────────────────────────────────────────────────
// 3. Order aggregate
// ────────────────────────────────────────────────────────────────────────────

export type OrderHistoryEntry = {
  fromState: OrderState | null; // null on the very first "created" row
  toState: OrderState;
  eventType: AdvanceEvent["type"] | "created";
  occurredAt: Date;
  metadata: Record<string, unknown>;
};

export type Order = {
  id: OrderId;
  state: OrderState;
  amountCents: AmountCents;
  paymentIntentId: PaymentIntentId | null;
  voidError: string | null;
  createdAt: Date;
  updatedAt: Date;
  history: readonly OrderHistoryEntry[];
};

// ────────────────────────────────────────────────────────────────────────────
// 4. Result + PaymentError
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tagged success/failure. Used for anything a caller needs to react to
 * differently based on the failure — currently the payment gateway.
 *
 * NOT used for programmer errors (invalid transitions from callers who
 * should know better, Zod parse failures at internal call sites). Those
 * throw, because they mean a bug.
 */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/**
 * The three payment-gateway failure modes we care about. Each drives a
 * different recovery in `OrderService`:
 *   - declined       → order becomes `rejected` (no cleanup needed)
 *   - network_error  → order becomes `needs_attention` (we don't know if the
 *                      auth landed on the provider side)
 *   - provider_error → same as network_error — treat as ambiguous
 */
export type PaymentError =
  | { kind: "declined"; reason: string }
  | { kind: "network_error"; cause: unknown }
  | { kind: "provider_error"; message: string };

/**
 * Errors from `applyTransition`. Only one for now — kept as a named type so
 * adding new failure modes later doesn't ripple through every call site.
 */
export type TransitionError = "invalid_transition";

/**
 * Compile-time exhaustive-case guard. If a discriminated-union `switch`
 * doesn't handle a variant, TS types the fall-through as that variant
 * rather than `never`, and `assertNever` fails to typecheck.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}
