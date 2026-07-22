# ADR 0001 — Tech Stack

**Status:** Accepted
**Date:** 2026-07-22
**Related plan:** `docs/plans/order-state-machine-plan.md` §0 (Scope Lock) and §3 (Tech Stack)

## Context

The assessment invites any language, in-memory storage, and a ~3-hour budget. We needed to pick a stack that:

1. **Solves the assessment cleanly** — the state machine + failure recovery + required tests are the deliverable.
2. **Sets up panel round 1** — that round asks the candidate to *extend* this take-home live with AI assistance. The stack must be one we operate in daily.
3. **Doesn't scream "over-engineered"** — the assessment explicitly says not to. A reviewer skimming should reach the state machine quickly, not wade through infrastructure.

## Decision

**Next.js 15 App Router + TypeScript (strict, `noUncheckedIndexedAccess`) + Tailwind v4 + Zod + Jest. In-memory storage via a class wrapping a `globalThis`-attached `Map`. Route Handlers under `/api/orders/*`. Deploy to Vercel.**

Explicitly rejected:
- **tRPC** — nice-to-have but ceremonial for four endpoints; Route Handlers with Zod give us the same input safety without the client boilerplate.
- **Drizzle / NeonDB** — assessment says in-memory is fine; adding a DB is theater.
- **Cypress / Playwright** — Jest covers the required tests; manual click-through covers the UI demo. E2E adds surface without proving the state machine any harder.
- **XState** — a `readonly` transition matrix + `applyTransition` function is 30 lines and *shows* the model rather than hiding it inside a library. The interviewer sees the design directly.
- **Auth (Clerk / Auth.js)** — not asked for.

## Consequences

**Positive:**
- The core deliverable (`src/server/domain/orderState.ts` + `tests/orderState.test.ts`) is readable in isolation. A reviewer can verify the assessment was solved without opening any framework code.
- Panel round 1 extension: we're editing a Next.js repo, which is what we edit every day.
- Small footprint (~15 files, no DB migrations, no ORM), so the docs stay proportional.
- Vercel deploy is one click, gives the interviewer a live URL.

**Negative / accepted:**
- In-memory storage is ephemeral. On Vercel serverless, state doesn't survive across cold instances. Called out in the README as a known limitation of the demo scope.
- No end-to-end typesafety from server to client (no tRPC), so client-side fetch calls type their own response shapes. Mitigated by keeping the response schemas in one file (`src/server/domain/types.ts`) that both server and client import.

## Alternatives Considered (not adopted)

| Option | Why not |
|---|---|
| A. Node + Fastify only (no Next.js, no UI) | Loses the panel round 1 comfort of Next.js patterns. |
| C. Next + tRPC + Drizzle + Neon + Cypress + UI | Reviewer would flag over-engineering; also 15-20 hours of work for docs+code, most of which is not the assessment. |
| tRPC in Option B | Ceremony for 4 endpoints; Route Handler + Zod is the smaller and clearer story. |
| Playwright over Cypress | Not on the fluency path; also E2E wasn't needed at all. |
