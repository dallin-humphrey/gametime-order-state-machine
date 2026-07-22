# OrderCard

## Overview

One row on the orders list. Shows amount, id prefix, event count, timestamp, and state badge.

**Location:** `src/app/components/OrderCard.tsx`

## Why this file exists

Extracts the row rendering from the page so the page code focuses on the layout + empty state. Also gives us a place to add per-row hover/interaction styling.

## Key decisions

### Presentational only

No state, no `use client`, no fetches. Whatever data is passed in via props is what's rendered. Reason: keeps the client bundle small and makes the component trivially reusable if we ever add a dashboard.

### `formatCents` inline

Small local helper. If we grew a currency formatting need across the app, we'd move it into `src/lib/format.ts`. Two lines don't earn a shared file yet.

### Short id prefix

Full UUIDs are visually noisy; the first eight chars are enough to eyeball for scanning. The detail page shows the full id.

## Related files

- `./StateBadgeDoc.md` — the badge inside every card.
- `../pageDoc.md` — the parent page.

## Testing notes

Not tested. Pure presentation.
