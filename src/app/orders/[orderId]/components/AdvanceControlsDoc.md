# AdvanceControls

## Overview

Client component that renders one labeled button per legal advance option for the current state. Buttons POST to `/api/orders/[id]/advance` and `router.refresh()` on success.

**Location:** `src/app/orders/[orderId]/components/AdvanceControls.tsx`

## Why this file exists

The state machine has four failure paths and one happy path. Making them clickable from the UI turns the assessment into a live demo — an interviewer clicks each button and watches the state badge change, without needing to run curl.

## Key decisions

### `switch (state)` returns typed `ControlOption[]`

Rather than a giant nested `if`, `optionsFor(state)` is one switch. Every case returns a `ControlOption[]`. TypeScript's exhaustiveness check (via `case "complete": ... case "cancelled": return []`) catches missed states.

### Simulation buttons are surfaced, not hidden

Labeled `"Authorize (simulate: decline)"`, `"Simulate: completion fails (void OK)"`, `"Simulate: completion + void fail"`. Reviewer sees exactly what will happen. Hiding them behind a dev-only query param would obscure the failure paths.

### Three tones — primary, warn, danger

- Primary = happy-path button (bright brand green).
- Warn = simulated single-fail path (amber).
- Danger = simulated double-fail path (red).

Colors mirror the badge visual language.

### `router.refresh()` after success

Re-runs the RSC render on the same route, so the header state badge and history table update from the server-fresh data. No client-side state duplication.

### Full-fetch, no shared client

Each button call is a plain `fetch`. Not worth a React Query cache for four possible interactions per page.

### "Allowed next states from …" hint at the bottom

Shows the raw `nextStates(order.state)` output. Useful for the interviewer to correlate the visible buttons to the state machine's declared successors. Uses the `allowed` prop passed by the parent RSC — no state-machine code lives on the client.

## Related files

- `../../../api/orders/[orderId]/advance/routeDoc.md` — the POST target.
- `./OrderDetailContentDoc.md` — parent, computes `allowed`.
- `~/server/domain/orderServiceDoc.md` — what the button payloads trigger server-side.

## Testing notes

Not tested. Manual click-through. If we add Cypress in a future phase, this component gets the primary e2e coverage.
