# E2E Test Suite (Playwright)

## Overview

Five Playwright specs — one per scenario, each covering the full UI flow and taking a full-page screenshot at the terminal state. Reads well cold: run `npm run test:e2e`, then open `playwright-report/index.html` to review every spec's outcome + screenshot in one file.

**Location:** `e2e/`

## Why this file exists

The four required scenarios from the assessment PDF are proven at the unit level in `tests/orderService.test.ts`. That's the type / logic guarantee. This suite is the *visual* guarantee — proves the UI actually renders each terminal state (green complete, red rejected, amber cancelled, red-pulsing needs_attention) and captures a screenshot of each so a reviewer can eyeball them without ever running the app.

## Scenarios

| # | File | Terminal state |
|---|---|---|
| 1 | [`1-happy-path.spec.ts`](./1-happy-path.spec.ts) | `complete` |
| 2 | [`2-payment-decline.spec.ts`](./2-payment-decline.spec.ts) | `rejected` |
| 3 | [`3-completion-fail-void-ok.spec.ts`](./3-completion-fail-void-ok.spec.ts) | `cancelled` |
| 4 | [`4-completion-fail-void-fail.spec.ts`](./4-completion-fail-void-fail.spec.ts) | `needs_attention` (loud red banner) |
| 5 | [`5-manual-resolve.spec.ts`](./5-manual-resolve.spec.ts) | `cancelled` (after manual resolve) |

## Key decisions

### `fullyParallel: false` + `workers: 1`

The in-memory store is process-global. Parallel workers would race on the shared Map. Serial execution is a small cost for a 5-spec suite and eliminates cross-test contamination.

### `reuseExistingServer: true` in dev

If you already have `npm run dev` running in another terminal, Playwright picks it up. Saves 15-20s per run.

### `data-state` attribute on StateBadge

Tests select on `[data-state="complete"]` rather than fuzzy text matching. Text-based selectors would break if we ever localized the labels; `data-state` is a stable test contract.

### Screenshots at every terminal state, not only on failure

Playwright's default is `only-on-failure`. We also call `page.screenshot()` explicitly in every spec so a passing run's report includes the "here's what the UI looks like when everything worked" evidence.

### Text-based button selectors

`getByRole("button", { name: "Simulate: completion + void fail" })`. If the button label ever changes, the test breaks — that's the correct signal (either the UI regressed or the test needs updating).

## Running

```bash
npm run test:e2e            # runs headless; prints pass/fail summary
npm run test:e2e:report     # opens the HTML report from the last run
npm run test:e2e:ui         # interactive Playwright UI (great for debugging)
```

## Where the artifacts live

- `playwright-report/` — HTML report with inline screenshots + traces on failure. **This is the file you open.**
- `test-results/` — raw screenshots (`scenario-N-*.png`) + traces + videos on failure.

Both directories are gitignored.

## Related files

- `~/tests/orderService.test.ts` — the same 4 required scenarios covered at the unit level.
- `~/src/app/components/StateBadgeDoc.md` — the `data-state` attribute we select on.
