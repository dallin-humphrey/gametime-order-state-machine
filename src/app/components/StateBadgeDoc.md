# StateBadge

## Overview

Colored pill representing an `OrderState`. Shared by the list page, detail page header, and history table.

**Location:** `src/app/components/StateBadge.tsx`

## Why this file exists

State is the primary information on every screen. Rendering it consistently — same color, same wording — across the app is what makes the UI walkthrough legible. Centralizing the styles + labels in this component means changing the visual language is one edit.

## Key decisions

### `Record<OrderState, string>` for styles + labels

```ts
const styles: Record<OrderState, string> = { ... };
```

The lookup tables are typed as `Record<OrderState, string>`, so adding a new state to `OrderState` in `types.ts` becomes a compile error here until the badge is defined. Same self-defending pattern as the transition matrix.

### `needs_attention` is deliberately loud

`animate-pulse` + a heavier border. That state means "manual resolution required" — the whole assessment turns on not silently swallowing failures. Visual loudness matches the semantic loudness.

### Colors, not icons

An icon library would add ceremony. Solid color badges with clear labels are more scannable in a table.

## Public surface

| Prop | Type | Purpose |
|---|---|---|
| `state` | `OrderState` | Which state to render |

## Related files

- `~/server/domain/typesDoc.md` — defines `OrderState`.
- `../orders/[orderId]/components/StateHistoryTableDoc.md` — uses it in every history row.

## Testing notes

Not tested. Manual walkthrough. If we added a visual regression tool (Chromatic), this component would be the first target.
