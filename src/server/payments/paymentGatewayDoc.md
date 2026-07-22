# PaymentGateway Interface

## Overview

The abstract boundary between the order service and any payment provider. Two methods: `authorize` (reserves funds and returns a `PaymentIntentId`) and `voidPayment` (releases a previously authorized amount). Both return `Result<T, PaymentError>` — declines are never thrown.

**Location:** `src/server/payments/paymentGateway.ts`

## Why this file exists

The assessment says "stub payment as an interface." This *is* the interface. The service programs against it, tests substitute `StubPaymentGateway`, and the running app uses `DemoPaymentGateway`. If we ever swap in real Stripe (Phase 8+ "what would we do with more time"), only this file's implementation changes — the service and tests don't need edits.

## Key decisions

### `Result<T, PaymentError>`, never `throw`

The four required scenarios split on *how* a payment failed, not *whether* it did:

- `declined` → drive the order to `rejected`.
- `provider_error` / `network_error` on void → drive to `needs_attention`.

If the gateway threw an `Error` for both, the service would have to `try/catch` and then re-inspect the error's shape to decide the recovery path. `Result` makes the decision structural: `switch (result.error.kind)` narrows to each case with compile-time exhaustiveness (via `assertNever`).

### `voidPayment`, not `void`

`void` is a TypeScript keyword (the return-type marker). Using it as a method name is legal but reads as noise (`gateway.void(...)` looks like a syntax error). `voidPayment` is unambiguous at every call site.

### Input types are named exports, not inline

`AuthorizeInput` and `VoidInput` are exported types. Reason: the tRPC-less API layer (Phase 4) uses them to build Zod schemas via `z.object({...}) satisfies z.ZodType<AuthorizeInput>` for input validation. If they lived inline in the method signature, the route handler would duplicate them.

## Types

```ts
export type PaymentAuthorization = {
  paymentIntentId: PaymentIntentId;
  amountCents: AmountCents;
  authorizedAt: Date;
};

export type PaymentVoid = {
  paymentIntentId: PaymentIntentId;
  voidedAt: Date;
};

export type AuthorizeInput = {
  orderId: OrderId;
  amountCents: AmountCents;
  paymentMethodToken: string;
};

export type VoidInput = {
  paymentIntentId: PaymentIntentId;
};

export type PaymentGateway = {
  authorize(input: AuthorizeInput): Promise<Result<PaymentAuthorization, PaymentError>>;
  voidPayment(input: VoidInput): Promise<Result<PaymentVoid, PaymentError>>;
};
```

## Public surface

| Export | Kind | Purpose |
|---|---|---|
| `PaymentAuthorization` | type | Successful authorize outcome |
| `PaymentVoid` | type | Successful void outcome |
| `AuthorizeInput` | type | authorize() request shape |
| `VoidInput` | type | voidPayment() request shape |
| `PaymentGateway` | type | The interface itself |

## Related files

- [`stubPaymentGatewayDoc.md`](./stubPaymentGatewayDoc.md) — test double (scriptable queue).
- [`demoPaymentGatewayDoc.md`](./demoPaymentGatewayDoc.md) — running-app implementation (deterministic on inputs).
- `orderServiceDoc.md` (Phase 3) — sole consumer; drives state transitions from the `PaymentError.kind`.

## Testing notes

The interface itself has no tests — implementations do. `tests/stubPaymentGateway.test.ts` covers the stub; the demo gateway's behavior is exercised indirectly through `tests/orderService.test.ts` (Phase 3) when the service uses the real demo gateway to walk the happy path.
