# StateHistoryTable

## Overview

Renders `order.history` as a table with columns: timestamp, event type, from→to states (as badges), and metadata (as pretty JSON).

**Location:** `src/app/orders/[orderId]/components/StateHistoryTable.tsx`

## Why this file exists

The assessment requires "state history with timestamps." The history table is where a reviewer verifies that the failure paths were captured honestly — `metadata.paymentError`, `metadata.completionError`, `metadata.voidError` all show up here verbatim.

## Key decisions

### Pretty-printed JSON for metadata

`JSON.stringify(entry.metadata, null, 2)` in a `<pre>`. Prettifying (e.g. "Declined: insufficient_funds") would obscure the actual object shape — which is the point of an audit trail. Reviewers see exactly what got recorded.

### Two StateBadges per row (from → to)

The visual `From → To` reads as a transition. Absent `fromState` (the "created" row) shows an em-dash instead of a badge.

### Index as key

`history` never reorders and never has entries removed, so index is a stable key here. If we ever mutated history entries in place, we'd swap to a stable `entryId`.

## Related files

- `~/app/components/StateBadgeDoc.md` — the badges in each row.
- `./OrderDetailContentDoc.md` — parent.

## Testing notes

Not tested. Rendered verbatim from the `Order.history` array — its shape is covered by the service tests.
