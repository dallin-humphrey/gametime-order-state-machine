# gametime-order-state-machine

Take-home assessment for Gametime's Senior / Staff Fullstack Engineer role — a small service that models an order state machine with stage-dependent failure recovery.

> **Status:** in progress — planning phase committed, implementation starting.
> A full `README.md` (what / why / how to run / tradeoffs / future work) will land once the code is in place.

## Assessment summary

Happy path: `initialized → payment_authorized → complete`.
Stage-dependent failure recovery:
- Payment declined → reject the order (no cleanup).
- Completion fails after authorization → void the payment, mark cancelled.
- Completion fails **and** the void fails → move to `needs_attention` for manual resolution. Do not silently swallow.

## Where things live

- **Plan doc (source of truth for the design):** [`docs/plans/order-state-machine-plan.md`](./docs/plans/order-state-machine-plan.md)
- **AI usage log (per the recruiter's ask):** _will live at `docs/ai/AI_USAGE.md`_

## Stack (locked)

Next.js 15 App Router · TypeScript (strict, `noUncheckedIndexedAccess`) · Tailwind · Zod · Jest.
In-memory storage — no database — per the assessment's guidance to keep it lean.
Deploy target: Vercel.
