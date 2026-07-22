# OrderService Singleton

## Overview

`getOrderService()` returns a module-level `OrderService` instance shared by every route handler and RSC server component. Wired with the `DemoPaymentGateway` (runtime) and `InMemoryOrderRepository` (globalThis-backed).

**Location:** `src/server/api/serviceInstance.ts`

## Why this file exists

Route handlers need an `OrderService`. Constructing one per request is wasteful and creates confusion about identity (two "different" services sharing the same map behave the same, but reasoning about that is friction). Concentrating the singleton behind a single accessor:

- Route handlers, RSC pages, and any tests that need "the app's service" all get the same instance.
- Swapping the gateway or repo for a future integration test is one edit here.

## Key decisions

### `globalThis` singleton

Next.js hot-reloads modules on save. Without `globalThis`, the "singleton" would reset on every dev save. Same rationale as `InMemoryOrderRepository`.

### `DemoPaymentGateway` + `InMemoryOrderRepository`, not swappable at runtime

The wiring is hardcoded. Tests import `StubPaymentGateway` and construct their own `OrderService` — they don't go through this singleton. Reason: keeping the runtime wiring simple prevents an "env-var accidentally flipped in prod" class of bugs; tests get isolation for free.

## Public surface

| Export | Kind | Purpose |
|---|---|---|
| `getOrderService()` | fn | Returns the singleton, creating it on first call |

## Related files

- [`../domain/orderServiceDoc.md`](../domain/orderServiceDoc.md) — the class being instantiated.
- [`../payments/demoPaymentGatewayDoc.md`](../payments/demoPaymentGatewayDoc.md) — runtime gateway.
- [`../repositories/orderRepositoryDoc.md`](../repositories/orderRepositoryDoc.md) — runtime store.
- `src/app/api/orders/*` — all route handlers call `getOrderService()`.

## Testing notes

Not tested directly. Route-handler tests would use it; unit tests deliberately don't (they construct their own OrderService with a fresh `InMemoryOrderRepository(new Map())` for isolation).
