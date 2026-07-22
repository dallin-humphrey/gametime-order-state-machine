# DemoPaymentGateway

## Overview

Runtime implementation of `PaymentGateway` used by the deployed app. Deterministic — no external calls, no real card processing. Behavior branches on the `paymentMethodToken` string in the authorize input.

**Location:** `src/server/payments/demoPaymentGateway.ts`

## Why this file exists

The running app (Vercel deployment) needs *something* behind `PaymentGateway`. Options considered:

1. Reuse `StubPaymentGateway` with a globally-scripted queue — messy, cross-request state.
2. Build a real Stripe integration — the assessment explicitly says "stub payment as an interface," so this would be over-engineering.
3. **A small deterministic implementation whose behavior is controlled by input tokens** — what we chose.

The UI's "Authorize (decline)" button sends `paymentMethodToken: "decline"`; the gateway inspects that and returns `err({ kind: "declined" })`. Every other token succeeds.

## Key decisions

### Token-driven behavior (only for `authorize`)

Only `authorize` inspects the token; `voidPayment` always succeeds. Reason: an alternative was to have the UI send a "void_fail" magic token on the void call, but the void call happens *inside* the service's recovery path — it's not driven by the UI directly. The service already needs a `simulateVoidFailure` flag on the advance request to short-circuit the void call before it hits the gateway. Keeping void deterministic here means the gateway's runtime behavior stays simple to reason about.

### `paymentIntentIdSchema.parse(\`pi_${randomUUID()}\`)`

Rather than `as PaymentIntentId`, we go through the branded schema. Two consequences:

- If a future change makes `paymentIntentIdSchema` stricter (e.g. exact `pi_` prefix requirement), we get a runtime error at construction rather than a stale branded value floating downstream.
- No `as` cast anywhere in the codebase — we always come *through* a schema to obtain a branded value.

### `satisfies PaymentError` on the decline object

```ts
return err({ kind: "declined", reason: "..." } satisfies PaymentError);
```

`satisfies` proves the object matches `PaymentError` without widening the inferred type — the value is still `{ kind: "declined"; reason: string }` at the call site, useful if downstream code narrows on `kind`.

## Public surface

| Export | Kind | Purpose |
|---|---|---|
| `DemoPaymentGateway` | class | The runtime implementation |
| `.authorize(input)` | method | Declines if `paymentMethodToken === "decline"`, else succeeds |
| `.voidPayment(input)` | method | Always succeeds with a fresh `voidedAt` |

## Related files

- [`paymentGatewayDoc.md`](./paymentGatewayDoc.md) — the interface being implemented.
- [`stubPaymentGatewayDoc.md`](./stubPaymentGatewayDoc.md) — sibling test double.
- `orderServiceDoc.md` (Phase 3) — instantiates `DemoPaymentGateway` in the running app.
- Route handlers (Phase 4) — the "Authorize (decline)" UI button sends `paymentMethodToken: "decline"` through here.

## Testing notes

No dedicated unit tests. Behavior is exercised through `tests/orderService.test.ts` (Phase 3) when the service walks the happy path with the demo gateway. The stub covers the failure paths directly.
