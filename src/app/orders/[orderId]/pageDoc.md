# Order Detail Page (`/orders/[orderId]`)

## Overview

Thin RSC route entry. Parses `orderId`, fetches the order, and delegates to `OrderDetailContent`. Handles 404s at the entry so downstream components don't need null-checks.

**Location:** `src/app/orders/[orderId]/page.tsx`

## Why this file exists

Convention: routes stay thin, content components hold logic. The three-line separation makes it easy to swap or wrap the content component (for auth, feature flags, etc.) without touching the route.

## Key decisions

### Branded-id parse first

`orderIdSchema.safeParse(rawId)` before repo lookup. A malformed id becomes `notFound()`, not a repo miss disguised as one. Also means downstream code knows `parsed.data` is a valid `OrderId` — no re-parse needed.

### `dynamic = "force-dynamic"`

Same reason as the list page — in-memory store mutates.

### `notFound()` for both cases

- Invalid id shape → 404 (client sent garbage).
- Valid id, missing order → 404 (deleted or never existed).

Both are user-facing 404s; distinguishing them in the UI adds no value.

## Related files

- `./components/OrderDetailContentDoc.md` — the content component.
- `../../api/orders/[orderId]/routeDoc.md` — the parallel HTTP endpoint (identical logic).

## Testing notes

Not tested. Manual click-through.
