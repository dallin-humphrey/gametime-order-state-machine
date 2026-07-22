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
- Ran `npm install` — succeeded / see notes.
- Ran `npm run build` — verified compile.
- Ran `npm run typecheck` — verified strict TS.
- Ran `npm test` — verified Jest wiring (no tests yet, exits clean).

**What was kept vs changed:**
- (to be filled in after Phase 0 verification)

---

<!-- Add one entry per meaningful AI-assisted step from here on. -->
