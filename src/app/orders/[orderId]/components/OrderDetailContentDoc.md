# OrderDetailContent

## Overview

The main detail-page view. Composes header (id + amount + state badge), an optional `voidError` banner, the payment-intent-id readout, the advance controls (client), and the history table.

**Location:** `src/app/orders/[orderId]/components/OrderDetailContent.tsx`

## Why this file exists

The `page.tsx` is thin by convention; all display logic lives here. Splitting them means we can wrap this content component in future providers (auth, feature flags) without touching the route.

## Key decisions

### `nextStates(order.state)` computed here, passed as prop

The client component (`AdvanceControls`) doesn't import any state-machine code. We compute `allowed` on the server and pass it down. Two consequences:

- The client bundle stays minimal — no state-machine module in the browser.
- The advance controls can render the "allowed next states" hint verbatim without re-deriving.

### Loud red banner for `voidError`

`border-2 border-red-500/60` + amber-red backdrop. The whole assessment turns on "don't silently swallow" — this is where a `needs_attention` order lives on-screen and the banner needs to be impossible to miss.

### Payment intent id shown only when present

An `initialized` or `rejected` order won't have one; conditional rendering keeps the layout tidy.

## Related files

- `~/server/domain/orderStateDoc.md` — `nextStates` source.
- `./AdvanceControlsDoc.md` — client child.
- `./StateHistoryTableDoc.md` — history child.

## Testing notes

Not tested. Manual walkthrough.
