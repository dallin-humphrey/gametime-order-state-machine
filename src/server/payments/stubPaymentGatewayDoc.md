# StubPaymentGateway

## Overview

Test double for `PaymentGateway`. Tests script the next expected outcome (success or failure) and the stub returns outcomes in FIFO order. Every call is recorded so tests can also assert on what the service asked for.

**Location:** `src/server/payments/stubPaymentGateway.ts`

## Why this file exists

`OrderService` tests (Phase 3) need to prove that:

1. A decline outcome drives the order to `rejected`.
2. A successful authorize + failed completion + successful void drives to `cancelled`.
3. A successful authorize + failed completion + failed void drives to `needs_attention` with `voidError` populated.

Making that provable requires per-test control over what the gateway returns. A hand-rolled `jest.mock()` would obscure the contract — a real class implementing `PaymentGateway` with a scriptable queue is more legible in test code.

## Key decisions

### FIFO queue per method

Two independent queues (`authorizeQueue`, `voidQueue`). Each script call `push`es outcomes; each gateway call `shift`s. Independence matters: scripting an `authorize` failure shouldn't consume a `void` outcome that a later test step expects.

### "No scripted outcome" throws

If `authorize()` is called and the queue is empty, the stub throws:

```ts
"StubPaymentGateway.authorize called without a scripted outcome. Call scriptAuthorize(...) in your test setup."
```

That's a test-authoring bug, not a domain event. A `Result.err(...)` would be misleading — it would look like a real payment failure. An exception makes the test author fix their setup.

### Every call is recorded

Public `authorizeCalls: AuthorizeInput[]` and `voidCalls: VoidInput[]` arrays let a test assert *what* the service passed (correct amount, correct payment intent id) not just *that* it called the gateway.

## Types (implements `PaymentGateway`)

```ts
class StubPaymentGateway implements PaymentGateway {
  scriptAuthorize(...outcomes: Array<Result<PaymentAuthorization, PaymentError>>): void;
  scriptVoid(...outcomes: Array<Result<PaymentVoid, PaymentError>>): void;

  authorize(input: AuthorizeInput): Promise<Result<PaymentAuthorization, PaymentError>>;
  voidPayment(input: VoidInput): Promise<Result<PaymentVoid, PaymentError>>;

  readonly authorizeCalls: AuthorizeInput[];
  readonly voidCalls: VoidInput[];
}
```

## Public surface

| Export | Kind | Purpose |
|---|---|---|
| `StubPaymentGateway` | class | The stub itself |
| `.scriptAuthorize(...)` | method | Enqueue `authorize` outcomes |
| `.scriptVoid(...)` | method | Enqueue `voidPayment` outcomes |
| `.authorizeCalls` | field | Record of every authorize call |
| `.voidCalls` | field | Record of every voidPayment call |

## Related files

- [`paymentGatewayDoc.md`](./paymentGatewayDoc.md) — the interface being implemented.
- [`../../../tests/stubPaymentGateway.test.ts`](../../../tests/stubPaymentGateway.test.ts) — proves it behaves as documented.
- `orderServiceDoc.md` (Phase 3) — primary consumer in tests.

## Testing notes

`tests/stubPaymentGateway.test.ts` covers:

1. Success outcome returned verbatim from queue.
2. Failure outcome (`declined`, `network_error`) returned verbatim.
3. FIFO ordering across multiple scripted outcomes.
4. Empty queue → throws with a specific error message.
5. Call recording (input capture with correct types).
6. Independence of `authorize` and `voidPayment` queues.
