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

<!-- Add one entry per meaningful AI-assisted step from here on. -->
