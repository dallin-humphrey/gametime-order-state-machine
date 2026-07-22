# `/api/orders/[orderId]` — Single Order

## Overview

`GET /api/orders/[orderId]` returns one order (state + full history) by id.

**Location:** `src/app/api/orders/[orderId]/route.ts`

## Why this file exists

The assessment asks for "querying its current state + history" — that's this endpoint. Returns the full `Order` shape (which includes `history: OrderHistoryEntry[]`), so a single request suffices for the detail page.

## Key decisions

### Branded-id parse at the boundary

The `orderId` from the URL is parsed through `orderIdSchema` before hitting the service. A non-UUID becomes `400 invalid_order_id` — never reaches the repo, never becomes a false "not found."

### Params are async (Next.js 15+)

```ts
type RouteContext = { params: Promise<{ orderId: string }> };
```

Next.js 15 made `params` a Promise. We `await` it once at the top of the handler.

## Endpoints

### `GET /api/orders/[orderId]`

**Responses:**
- `200 Order` on success.
- `400 { error: "invalid_order_id" }` if `orderId` isn't a UUID.
- `404 { error: "not_found" }` if no order exists at that id.

## Related files

- [`../routeDoc.md`](../routeDoc.md) — list + create.
- [`./advance/routeDoc.md`](./advance/routeDoc.md) — advance.

## Testing notes

Covered indirectly by the service's `get(id)` tests plus manual `curl` verification. In-repo e2e tests are out of scope for this phase.
