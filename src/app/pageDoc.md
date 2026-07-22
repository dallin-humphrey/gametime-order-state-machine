# Orders List Page (`/`)

## Overview

Landing page — lists all orders with their current state, and hosts the "New Order" control. Server Component with `dynamic = "force-dynamic"` because in-memory state changes per request.

**Location:** `src/app/page.tsx`

## Why this file exists

Gives the interviewer a click-through demo. The state-machine + API can be exercised via `curl`, but a UI makes the failure paths (decline, cancelled, needs_attention) visually distinguishable via colored state badges — which is more legible in a live walkthrough.

## Key decisions

### Server Component reading the service directly

`getOrderService().list()` is called on the server during render. No fetch, no waterfall. The alternative — client component with `useEffect` + `fetch("/api/orders")` — adds a network roundtrip for data we already have in-process.

### `dynamic = "force-dynamic"`

The in-memory store changes on every advance. Prerendering would cache stale data. `force-dynamic` opts out of prerendering explicitly.

### Client boundary is minimal

Only the "New Order" input + submit lives in a client component (`NewOrderButton`). Everything else — header, cards, empty state — is server-rendered.

## Related files

- [`./components/NewOrderButtonDoc.md`](./components/NewOrderButtonDoc.md) — client "New Order" action.
- [`./components/OrderCardDoc.md`](./components/OrderCardDoc.md) — one row in the list.
- [`./orders/[orderId]/pageDoc.md`](./orders/[orderId]/pageDoc.md) — detail page each row links to.

## Testing notes

Manual click-through only. Assessment doesn't require UI testing; the state-machine tests cover the underlying logic.
