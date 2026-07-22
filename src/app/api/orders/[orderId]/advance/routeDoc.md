# `/api/orders/[orderId]/advance` — The Only Mutation

## Overview

`POST /api/orders/[orderId]/advance` is the sole write endpoint. Every state change — authorize, complete, manual resolve — flows through here.

**Location:** `src/app/api/orders/[orderId]/advance/route.ts`

## Why this file exists

The service enforces "one write path" (`advance()`), and this route mirrors that at the HTTP layer. One POST for every transition means the client doesn't have to remember which endpoint to hit for which event — it always POSTs to `/advance` with an event body.

## Key decisions

### `z.discriminatedUnion` on `event.type`

```ts
event: z.discriminatedUnion("type", [
  z.object({ type: z.literal("authorize_payment") }),
  z.object({ type: z.literal("complete_order") }),
  z.object({ type: z.literal("resolve_manual") }),
]),
```

Zod's `discriminatedUnion` gives us:
- Runtime rejection of unknown event types with `400 invalid_input`.
- Type inference that mirrors our `AdvanceEvent` discriminated union.
- A single place to add new event types (add here + in `types.ts` + in the service `switch`).

### `simulate*` flags are opt-in booleans

`simulateCompletionFailure` and `simulateVoidFailure` are optional. Absent = happy path. The UI's "Simulate: …" buttons send these flags explicitly. They're on the route because they're an *input*, not part of the event's identity — this matches how `AdvanceInput` is shaped in the service.

### `instanceof` for known error kinds → HTTP status

```ts
if (error instanceof OrderNotFoundError)     → 404
if (error instanceof IllegalTransitionError) → 409
else                                          → 500
```

Named error classes (added in Phase 3.5) let us map to precise HTTP codes without string-matching on `.message`. Anything not caught by an `instanceof` is a bug — we log it and return 500.

## Endpoint

### `POST /api/orders/[orderId]/advance`

**Body:**
```jsonc
{
  "event": { "type": "authorize_payment" | "complete_order" | "resolve_manual" },
  "paymentMethodToken": "pm_test",            // optional; used only for authorize_payment
  "simulateCompletionFailure": false,          // optional; complete_order only
  "simulateVoidFailure": false                 // optional; complete_order only
}
```

**Responses:**
- `200 Order` — advance succeeded, returns the updated order.
- `400 { error: "invalid_order_id" }` — `[orderId]` isn't a UUID.
- `400 { error: "invalid_input", issues }` — body didn't parse.
- `404 { error: "not_found" }` — no order at that id.
- `409 { error: "illegal_transition", from, to, reason }` — the current state doesn't allow the requested move.
- `500 { error: "internal_error", detail }` — unexpected. Logged server-side.

## Related files

- [`../../routeDoc.md`](../../routeDoc.md) — collection endpoints.
- [`../routeDoc.md`](../routeDoc.md) — read one.
- [`../../../../server/domain/orderServiceDoc.md`](../../../../server/domain/orderServiceDoc.md) — the `advance()` method.

## Testing notes

Not covered by dedicated route tests. The service's `orderService.test.ts` covers the logic; the route is a thin adapter (Zod parse → service call → error mapping). Manual verification:

```bash
# Create an order
ORDER_ID=$(curl -sX POST http://localhost:3000/api/orders \
  -H 'content-type: application/json' \
  -d '{"amountCents":1000}' | jq -r '.id')

# Advance (authorize)
curl -sX POST "http://localhost:3000/api/orders/$ORDER_ID/advance" \
  -H 'content-type: application/json' \
  -d '{"event":{"type":"authorize_payment"}}'
```
