# OrderRepository (in-memory)

## Overview

The persistence boundary — a `Map<OrderId, Order>` behind the `OrderRepository` interface. Every order and its full history live here. Attached to `globalThis` by default so state survives Next.js HMR (dev) and warm serverless instances (Vercel prod).

**Location:** `src/server/repositories/orderRepository.ts`

## Why this file exists

The assessment says "in-memory storage is fine." This is the smallest honest implementation. The interface (`OrderRepository`) separates *what* the store does from *how* — the service depends on the interface, so if we ever wired up a real DB (Postgres via Drizzle, per the "with more time" section of the README), only the guts of `InMemoryOrderRepository` would need swapping.

For a project this size, the interface layer is arguably ceremony. It stays because it makes the storage boundary explicit in code review, and it lets tests inject a fresh `Map` for isolation without any mocking library.

## Key decisions

### `globalThis` singleton for the default map

Next.js hot-reloads modules on file save; every reload gets a fresh module instance. Without `globalThis`, our `Map` would reset on every save in dev. Attaching to `globalThis.__orderStore` keeps a single shared instance across reloads.

On Vercel: warm serverless instances retain the map; cold starts start empty. That's called out in the README under Known Limitations.

### Constructor takes an optional `store`

```ts
constructor(store?: Map<OrderId, Order>) {
  this.store = store ?? getGlobalStore();
}
```

Tests pass their own `new Map()` to guarantee isolation without touching global state. Production code calls `new InMemoryOrderRepository()` and gets the global instance.

### `update` takes a fully-formed `historyEntry`

The service constructs the history entry (with the correct `fromState`, `metadata`, timestamps) and hands it to the repo in one call. Reason: history construction lives next to the transition decision in the service, so a reader sees both in one place. If the repo constructed the entry itself, the transition-vs-history logic would be split across two files.

### `undefined` vs `null` in `OrderUpdate`

```ts
paymentIntentId?: PaymentIntentId | null;
voidError?: string | null;
```

- `undefined` = "don't touch this field" (leaves the existing value).
- `null` = "explicitly clear it."

This lets the service null-out `voidError` on manual resolve without also nulling the `paymentIntentId`. Documented at the type site.

### `list` sorts most-recent-first

Small quality-of-life: the list page shows recent orders at the top without a client-side sort.

## Public surface

| Export | Kind | Purpose |
|---|---|---|
| `OrderRepository` | type | The interface — service depends on this |
| `OrderUpdate` | type | Fields available to change on `update` |
| `InMemoryOrderRepository` | class | Shipped implementation |
| `.create({ amountCents })` | method | Insert new order in `initialized` |
| `.get(id)` | method | Lookup by branded id, or `null` |
| `.list(limit?)` | method | Recent orders, most-recent-first |
| `.update(id, changes)` | method | State change + history append |
| `.clear()` | method | Test-only — reset the shared map |

## Related files

- `../domain/typesDoc.md` — `Order`, `OrderId`, `OrderState` come from here.
- `../domain/orderServiceDoc.md` — sole consumer.
- [`../../../tests/orderService.test.ts`](../../../tests/orderService.test.ts) — exercises the repo via service.

## Testing notes

No dedicated unit test file. `orderService.test.ts` fully exercises the repo — every scenario creates a fresh `InMemoryOrderRepository(new Map())` and asserts the persisted shape (state, history rows, `voidError`, `paymentIntentId`). If the repo ever grew a persistent implementation with retry policy, we'd add `tests/inMemoryOrderRepository.test.ts`.
