# AI Usage Log

> **Purpose:** Per Gametime's ask (recruiter email 2026-07-22): *"we ask that you document where and why you used [AI], and how you validated or challenged the outputs along the way."*
>
> **Format:** curated highlights, not every prompt. Each entry names *what* AI helped with, *how* it was validated, and *what changed* from its first draft.
>
> **Style:** honest. If AI was wrong, that's kept in the log.

---

## 2026-07-22 — Assessment intake + plan drafting

**What AI helped with:**
- Read the assessment PDF, extracted the requirements matrix, drafted a scope-tradeoffs table.
- Proposed three tiered implementation options (lean Node service / Next.js API routes / full Next+tRPC+Drizzle stack) with time estimates.

**How it was validated:**
- Cross-checked the extracted requirements against the raw PDF text (states, failure paths, required tests, submission format).
- The scope tradeoffs were argued out against the assessment's own "don't over-engineer" instruction.

**What was kept vs changed:**
- Kept: the three-option framing.
- Changed: initial recommendation was Option C (full stack). After reading "don't over-engineer" more carefully, Option B (Next.js + Route Handlers + in-memory) was picked instead.

**Artifacts:** `docs/plans/order-state-machine-plan.md`.

---

## 2026-07-22 — Phase 0 scaffold

**What AI helped with:**
- Wrote `package.json`, `tsconfig.json` (with `strict` + `noUncheckedIndexedAccess`), Tailwind v4 + PostCSS config, Jest config, ESLint config, and a placeholder `layout.tsx` + `page.tsx`.

**How it was validated:**
- `npm install` succeeded. Hit a `ts-jest` peer conflict against TypeScript 7 (latest) — pinned TS to `^6` (still modern, satisfies ts-jest's `<7` peer).
- `npm run build` compiled cleanly.
- `npm run typecheck` clean.
- `npm test` exited 0 with no tests (via `passWithNoTests`).

**What was kept vs changed:**
- Kept the strict + `noUncheckedIndexedAccess` tsconfig.
- Changed TypeScript version from `latest` (7.x) to `^6` after peer conflict.
- Fixed a Turbopack workspace-root warning by pinning `turbopack.root` in `next.config.mjs`.

## 2026-07-22 — Phase 1 domain types + state machine

**What AI helped with:**
- Wrote `src/server/domain/types.ts` (branded IDs via `z.brand<"Tag">()`, `OrderState` union, `AdvanceEvent` discriminated union, `Result<T, E>`, `PaymentError`, `assertNever`).
- Wrote `src/server/domain/orderState.ts` (transition matrix as `as const satisfies Record<OrderState, readonly OrderState[]>`, `applyTransition`, `nextStates`, `isTerminal`).
- Wrote per-file docs (`typesDoc.md`, `orderStateDoc.md`, `tests/testsDoc.md`) explaining every non-obvious decision in plain English.
- Wrote `tests/orderState.test.ts` — 48 tests covering matrix invariants, happy path, all failure-path transitions, illegal moves per source state, `it.each` sweeps of terminal states, and Zod branded schema parsing.

**How it was validated:**
- `npm run typecheck` — clean.
- `npm test` — 48/48 pass.
- Two errors surfaced and were fixed:
  1. Tests couldn't find `it`/`expect` globals. Fix: import from `@jest/globals` (more explicit than relying on ambient `@types/jest`).
  2. `ts-jest` complained about `rootDir`. Fix: added `"rootDir": "."` to `tsconfig.json`.

**What was kept vs changed:**
- Kept branded-IDs + Zod as source of truth (matches ADR 0003).
- Kept `as const satisfies` matrix pattern (matches ADR 0002).
- Simplified `TransitionError` from a two-variant union (`"invalid_transition" | "terminal_state"`) to a single `"invalid_transition"` — terminal is just the empty-successors case, no need to distinguish. Cleaner.

---

## 2026-07-22 — Phase 2 payment gateway interface + stub

**What AI helped with:**
- Drafted `PaymentGateway` type (both methods returning `Result<T, PaymentError>`), `StubPaymentGateway` with scriptable FIFO queues, and `DemoPaymentGateway` (token-driven decline).
- 10 Jest tests covering FIFO order, empty-queue throw, and queue independence.

**How it was validated:**
- Typecheck + tests green (58 total).
- Named the method `voidPayment` (not `void`) after realizing `void` is a TS keyword — cleaner reads at every call site.

## 2026-07-22 — Phase 3 repository + service + 4 required scenarios

**What AI helped with:**
- Wrote `InMemoryOrderRepository` (globalThis-attached Map, optional constructor-injected Map for test isolation) + `OrderService` orchestrator.
- The single write path (`commit()`) enforces `applyTransition` before every repo write — no bypass.
- 11 `describe` blocks covering the 4 required scenarios + manual resolve + illegal-move throws + reads.

**How it was validated:**
- Fixed 2 typecheck errors surfaced by strict TS:
  - `PaymentError` was imported from `paymentGateway.ts` where it isn't declared — moved import to `types.ts`.
  - Typo: `paymentIntentId?: OrderId | null` in the commit helper's `extra` param — should have been `PaymentIntentId`. Branded types caught this at compile time; without the brand it would have failed silently at runtime.
- 1 test failure (list sort race — two orders created in the same millisecond). Fixed by switching `list()` from `createdAt` sort to reverse-Map-iteration (insertion order is spec-guaranteed). Documented in the file.
- 69/69 tests green. Typecheck clean.

## 2026-07-22 — Phase 4 route handlers

**What AI helped with:**
- Wrote all three route files (`/api/orders`, `/api/orders/[orderId]`, `/api/orders/[orderId]/advance`) with Zod-parsed bodies + branded id validation at the boundary.
- Refactored `OrderService` to throw named error classes (`OrderNotFoundError`, `IllegalTransitionError`) so the advance route can `instanceof`-map to precise HTTP status codes without string-matching on `.message`.
- Added `serviceInstance.ts` globalThis singleton so route handlers + RSC pages share one `OrderService`.

**How it was validated:**
- Typecheck + 69 tests + `next build` all green. Build showed all 3 API routes registered as expected (`ƒ` — dynamic).

## 2026-07-22 — Phase 5 UI

**What AI helped with:**
- Wrote list + detail pages as RSCs (reading the service singleton directly, no fetch waterfall).
- Two client components: `NewOrderButton`, `AdvanceControls`.
- `StateBadge` with `Record<OrderState, string>` typing so adding a new state fails to compile without a color + label.
- Simulation buttons surfaced with explicit labels (`Simulate: completion + void fail`).

**How it was validated:**
- Typecheck + 69 tests + `next build` all green. All 6 routes registered.
- Manual click-through (below).

## 2026-07-23 — Phase 7 Playwright e2e (added after Phase 6 because manual smoke testing was slow)

**What AI helped with:**
- Installed `@playwright/test` + chromium, wrote `playwright.config.ts` with `reuseExistingServer` + HTML reporter + explicit screenshots per spec.
- Added `data-state` attribute to `StateBadge` so tests select on a stable contract, not fuzzy text.
- Five specs mirroring the four required scenarios + manual resolve, each ending with a full-page screenshot of its terminal state.

**How it was validated:**
- `npm run test:e2e` — 5/5 passed on first run in 5.5s.
- Manually opened one screenshot (needs_attention) to verify the loud red banner, both errors in metadata JSON, and the manual-resolve button all render as designed.
- HTML report at `playwright-report/index.html` includes every screenshot inline.

<!-- Add one entry per meaningful AI-assisted step from here on. -->
