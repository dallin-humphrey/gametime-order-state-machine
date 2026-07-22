# `/api/orders` — Collection Route

## Overview

Two operations on the order collection:

- `GET /api/orders?limit=N` → `{ orders: Order[] }`  (default limit 50, capped at 100)
- `POST /api/orders` → 201 `Order` (creates a new order in `initialized`)

**Location:** `src/app/api/orders/route.ts`

## Why this file exists

Fulfills the assessment's "Expose a small API for creating an order [...] and querying its current state + history" for the *collection* half (list + create). The single-order operations live at `../[orderId]/routeDoc.md` and `../[orderId]/advance/routeDoc.md`.

## Key decisions

### Zod at the boundary

Every request body is `.safeParse`-checked before the service is called. A parse failure returns `400 { error: "invalid_input", issues: [...] }`. The service is guaranteed to receive a well-typed input; branded fields (`AmountCents`) are re-parsed through the branded schema so runtime + compile-time distinctness both apply.

### `limit` clamped to `[1, 100]`

Prevents an accidental `?limit=999999999` from generating a giant response. Documented in-code.

### `NextResponse.json` for everything

Uniform response shape means the client can `.json()` without discriminating on Content-Type.

## Endpoints

### `GET /api/orders?limit=N`

Returns most-recent-first. `limit` clamped `[1, 100]`, default 50.

**Response:** `200 { orders: Order[] }`

### `POST /api/orders`

**Body:** `{ amountCents: number }` (int, non-negative)

**Responses:**
- `201 Order` on success.
- `400 { error: "invalid_input", issues }` on Zod parse failure.

## Related files

- [`../[orderId]/routeDoc.md`](../[orderId]/routeDoc.md) — single-order read.
- [`../[orderId]/advance/routeDoc.md`](../[orderId]/advance/routeDoc.md) — advance.
- [`../../../server/api/serviceInstanceDoc.md`](../../../server/api/serviceInstanceDoc.md) — the service singleton.

## Testing notes

No dedicated route test — the service's Jest suite covers the underlying logic. Manual verification is `curl -X POST http://localhost:3000/api/orders -d '{"amountCents":1000}' -H 'content-type: application/json'`. If we add Playwright/Cypress in a future phase, the collection endpoints get e2e coverage first.
