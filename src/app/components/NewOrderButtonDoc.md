# NewOrderButton

## Overview

Client component with an amount input (in cents) and a submit button. POSTs to `/api/orders` and navigates to `/orders/[id]` on success.

**Location:** `src/app/components/NewOrderButton.tsx`

## Why this file exists

Creating an order requires interaction (typing an amount + clicking). That has to be client-side. Isolating it in one small component keeps the parent page fully server-rendered.

## Key decisions

### Amount is in cents on the wire

The API accepts `amountCents: number` (integer). Rather than convert dollars→cents in the UI, the input works directly in cents. No fractional dollars = no rounding bugs.

Tradeoff: cents-typed input is less user-friendly. For a demo where we want to also demonstrate an integer-typed amount contract, it's the honest choice.

### `router.push` + `router.refresh` after create

`push` navigates. `refresh` re-runs the RSC render on the target page so the freshly-created order is visible immediately (otherwise the detail page would show a not-found for the brief window before Next's cache refreshes).

### Local `error` state, not a global toast

The error box lives right under the button. In a bigger app we'd have a shared toast system; for a demo, colocated error rendering keeps failure legible without extra machinery.

## Related files

- `../api/orders/routeDoc.md` — POST endpoint.
- `../pageDoc.md` — parent page.

## Testing notes

Not tested. Manual click-through.
