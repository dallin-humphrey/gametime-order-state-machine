# Order State Machine — Gametime Take-Home Plan

> **Status:** SCOPE LOCKED — building Option B (see §0 below).
> **Date opened:** 2026-07-22
> **Scope locked:** 2026-07-22
> **Submission deadline:** ~2026-08-01 (10 days from receipt)
> **Submit to:** `https://app8.greenhouse.io/tests/ff7575d6176c01b3af3daa837bcf6753`
> **Assessment PDF:** `C:\Users\dalli\Downloads\Gametime.pdf`
> **Project root:** `C:\Users\dalli\gametime`
> **Related docs (to be created):**
> - `docs/features/orderStateMachineMasterDoc.md`
> - `docs/decisions/0001-tech-stack.md` … `0004-error-handling.md`
> - `docs/ai/AI_USAGE.md`
> - `README.md`
>
> **Purpose:** Lock the full design of the take-home before writing any implementation code. This is the artifact Dallin will re-read the morning of the panel to defend every decision. If a decision changes mid-build, update this file first, then the code.

---

## 0. Scope Lock — Option B (supersedes anything below that conflicts)

After weighing the assessment's "don't over-engineer" line against panel comfort, we picked the **middle option**. What's in and out:

**In:**
- Next.js 15 App Router + TS strict + Tailwind + Zod + Jest
- **In-memory storage** via a Repository class holding a `Map<OrderId, Order>` on `globalThis` (survives HMR + warm serverless)
- **Next.js Route Handlers** at `/api/orders/*` — no tRPC
- Small 2-page UI (orders list + order detail with advance controls) so the interviewer can click through
- Per-file `NameDoc.md` docs, master feature doc, ADRs
- Deploy to Vercel
- Repo: `github.com/dallin-humphrey/gametime-order-state-machine`
- Brand color: primary `#00D67C` (Gametime-inspired electric green — swap the exact hex in Tailwind config if we get it)

**Out (was in the original Option C plan):**
- NeonDB / Drizzle / drizzle-kit
- tRPC / React Query
- Cypress (Jest covers unit; manual click-through covers UI)
- Repository interface abstraction (in-memory only, wrapped in a class)
- Test-branch DB setup

**Rewritten sections for Option B:**
- §3 Tech Stack — remove Drizzle/Neon/tRPC/Cypress
- §6 File Structure — remove `src/server/db/`, `src/trpc/`, `cypress/`, `drizzle/`
- §7 Database Design — **N/A**, replaced by an in-memory repository class documented in `inMemoryOrderRepositoryDoc.md`
- §9 API Design — same 4 endpoints, exposed as Route Handlers (POST `/api/orders`, POST `/api/orders/[id]/advance`, GET `/api/orders/[id]`, GET `/api/orders`) with Zod-parsed bodies/params
- §15 Implementation Phases — collapsed to Phase 0-6 (see task list)

Everything else (§4 Domain Model, §5 Architecture layers, §8 State Machine Design, §10 UI Design, §11 TypeScript Best Practices, §12 Documentation Standard, §13 Testing Strategy, §14 AI Usage Log, §17 Open Questions resolved, §18 Non-goals) is unchanged and applies as written.

The verbose Option C content below is retained deliberately — it captures the "how would we extend this to production" thinking, which is the material for panel round 2 (Architecture). Do not delete.

---

## TL;DR

Build a small state-machine-backed order service that models `initialized → payment_authorized → complete` with stage-dependent failure recovery (decline / void / needs_attention). The core state machine is a pure module with exhaustive Jest coverage. A `PaymentGateway` interface is stubbed. Persistence uses **NeonDB + Drizzle** (with an `InMemoryOrderRepository` for unit tests), and the "small API" is exposed as **tRPC** procedures backed by a thin Next.js **App Router** UI so we can extend it live during panel step 1. Documentation follows the Squiresolutions per-file `NameDoc.md` convention.

The assessment says "3 hours, don't over-engineer." We're consciously exceeding that budget — the ROI is (a) the panel round 1 forces us to *extend* this code live with AI, so we want a stack we operate in every day, and (b) the docs are for our own walkthrough. That tradeoff is called out explicitly in `Scope & Tradeoff Acknowledgment` below and will be echoed in the README.

---

## 1. Assessment Recap

**Verbatim from PDF:**

- Model a state machine for an order:
  - Happy path: `initialized → payment_authorized → complete`
  - Payment declined → **reject** (no cleanup)
  - Completion fails after authorization → **void** the payment, mark **cancelled**
  - Completion fails **and** void fails → **needs_attention** (do not silently swallow)
- Enforce valid transitions.
- Record state history with timestamps.
- Stub payment as an interface.
- In-memory storage is fine.
- Small API: create order, advance state, query current state + history.
- Tests required: happy path, payment decline, completion failure with successful void, completion failure with failed void.
- **"Roughly 3 hours."** **"Don't over-engineer it."**
- Submit as GitHub repo with README covering: what/why, how to run, tradeoffs, what you'd do with more time.
- Document AI use (where/why/how validated) per the recruiter email.

---

## 2. Scope & Tradeoff Acknowledgment

The assessment invites a minimal solution (single Node file + Jest, ~3 hours). We are deliberately going bigger:

| Their ask | Our choice | Why we're going bigger |
|---|---|---|
| Any language | **TypeScript** | Panel round 1 is *agentic-assisted coding* on this repo. TS gives the AI type signals and prevents silent regressions. |
| In-memory storage is fine | **NeonDB + Drizzle** (also keeps an in-memory repo for unit tests) | Demonstrates Drizzle fluency + gives interviewers a real DB to click through. Panel round 2 (Architecture) will ask "how would you scale it" — having Postgres already in the picture makes that a shorter conversation. |
| Small API | **tRPC + Next.js App Router + React Query** | End-to-end type safety from DB → server → client is the pitch. Also gives us a UI surface to demo live. |
| Tests | **Jest for unit + Cypress for E2E** | Assessment only requires unit-level. Cypress is added because panel round 3 is a live UI build, and the E2E harness makes that faster. |
| Docs = a README | **Per-file `NameDoc.md` + master doc + ADR-style decisions** | Panel round 1 is a *cold-open live extension*. Docs are how we read the codebase on stage. |

**Risk we're taking:** an interviewer skimming the repo may flag "this violates 'don't over-engineer.'"

**Mitigation, called out in the README:**
1. Core deliverable — the pure state machine + its four required tests — is a single self-contained module (`src/server/domain/orderState.ts` + `tests/orderState.test.ts`) that a reviewer can read in isolation to confirm the assessment was solved.
2. The rest of the stack is framed as *how I intend to extend this in the panel*, not as production-readiness theater.
3. The `README.md → Tradeoffs` section names this explicitly instead of hiding it.

---

## 3. Tech Stack (with rationale we can defend verbally)

| Layer | Choice | Why |
|---|---|---|
| Runtime / build | **Next.js 15 (App Router)** | Single deploy target (Vercel-friendly), same repo hosts API + UI + tRPC, RSC-ready if we want it. |
| Language | **TypeScript (strict, `noUncheckedIndexedAccess`)** | Non-negotiable for a state machine — makes exhaustive-checking `never`-based switches free. |
| Styling | **Tailwind CSS v4** | Speed of iteration for the demo UI; no CSS-in-JS runtime cost. |
| API layer | **tRPC v11** | End-to-end types from server procedure to `useQuery` hook. Assessment asks for a "small API," this is the smallest way to get one that stays honest with the client. |
| Data fetching | **@tanstack/react-query** (via tRPC's React adapter) | Cache invalidation on mutations is the pattern we'll use for "advance state → refresh detail page." |
| ORM | **Drizzle** | Schema-first, TS-native, `$type<T>()` for JSON columns, ergonomic migrations. |
| Database | **NeonDB (serverless Postgres)** | Connection string provided by user; branchable Postgres, works with Drizzle out of the box. |
| Validation | **Zod** | Source of truth for input types (`z.infer` derives TS type from schema). Also gives us `.brand()` for runtime-checkable branded IDs. |
| Env parsing | **`@t3-oss/env-nextjs`** | Fail fast on missing env at build time. |
| Unit tests | **Jest + `ts-jest`** | Standard; runs the pure state-machine tests fast without a DB. |
| E2E tests | **Cypress** | Matches Squiresolutions convention. Preferred over Playwright for consistency with Dallin's other repos. |
| Env / secrets | **`.env.local`** (gitignored) | Neon connection string never leaves the machine. |

### Non-choices (explicitly rejected)

- **Playwright** — Cypress is what Dallin uses in prod repos; consistency wins.
- **Prisma** — Drizzle is his preference and matches Squiresolutions.
- **Redux / Zustand** — React Query cache is enough for a demo of this size.
- **Clerk / Auth.js** — no auth needed; the assessment doesn't ask for it, and adding it would be actual over-engineering.
- **State machine library (XState)** — pure functions + a `readonly` transition table are ~30 lines and let us *show* the state model rather than hide it inside a library.

---

## 4. Domain Model

### 4.1 States (the vocabulary)

| State | Definition | Terminal? |
|---|---|---|
| `initialized` | Order created, no payment attempted yet | No |
| `payment_authorized` | Payment method authorized; funds reserved, not captured | No |
| `complete` | Order fulfilled successfully | **Yes** |
| `rejected` | Payment declined during authorization; no side effects to undo | **Yes** |
| `cancelled` | Completion failed but the void succeeded — clean unwind | **Yes** |
| `needs_attention` | Completion failed AND void failed — manual resolution required | **Semi** (can transition to `cancelled` on manual resolution) |

### 4.2 Transitions (the rules)

```
                 authorizePayment (success)                 completeOrder (success)
    initialized ────────────────────────────► payment_authorized ────────────────────► complete
        │                                             │
        │ authorizePayment (declined)                 │ completeOrder (fail) + void (success)
        ▼                                             ├────────────────────────────────► cancelled
     rejected                                         │
                                                      │ completeOrder (fail) + void (fail)
                                                      └────────────────────────────────► needs_attention
                                                                                                │
                                                                                                │ manual resolution
                                                                                                ▼
                                                                                            cancelled
```

### 4.3 Transition matrix (source of truth in code)

```ts
export const transitions = {
  initialized:        ["payment_authorized", "rejected"],
  payment_authorized: ["complete", "cancelled", "needs_attention"],
  complete:           [],
  rejected:           [],
  cancelled:          [],
  needs_attention:    ["cancelled"],
} as const satisfies Record<OrderState, readonly OrderState[]>;
```

Why `as const satisfies …`:
- `as const` keeps every string a *literal*, so `transitions.initialized[0]` narrows to `"payment_authorized"`, not `string`.
- `satisfies Record<OrderState, …>` proves at compile time we covered every state without widening the value's inferred type.
- Adding a new state to `OrderState` forces a TS error here until we fill in its allowed successors — self-defending schema.

### 4.4 Branded types (identity)

Domain IDs and monetary amounts are `branded` so a caller can't accidentally pass a `TicketId` where an `OrderId` is expected — the compiler rejects it.

```ts
import { z } from "zod";

export const orderIdSchema        = z.string().uuid().brand("OrderId");
export const paymentIntentIdSchema = z.string().min(1).brand("PaymentIntentId");
export const amountCentsSchema    = z.number().int().nonnegative().brand("AmountCents");

export type OrderId         = z.infer<typeof orderIdSchema>;
export type PaymentIntentId = z.infer<typeof paymentIntentIdSchema>;
export type AmountCents     = z.infer<typeof amountCentsSchema>;
```

Using `z.brand()` gets us both:
- Compile-time distinctness (`OrderId` is not assignable to `PaymentIntentId`).
- Runtime validation at the boundary (the same schema parses input into the branded type).

### 4.5 Discriminated union — advance events

Every request to advance an order is one of a small set of tagged events. The `type` field is the discriminant.

```ts
export type AdvanceEvent =
  | { type: "authorize_payment"; paymentMethodToken: string }
  | { type: "complete_order" }
  | { type: "resolve_manual" }; // needs_attention → cancelled
```

Switching on `event.type` narrows each branch automatically and a `default: assertNever(event)` guard catches missed cases at compile time.

### 4.6 Result type (explicit failure)

Payment operations can fail in domain-meaningful ways (declined, network, void_failed). We model this as a `Result<T, E>` instead of throwing, so `service.completeOrder` can *react to* the failure rather than swallow-and-throw.

```ts
export type Result<T, E> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

export type PaymentError =
  | { kind: "declined";       reason: string }
  | { kind: "network_error";  cause: unknown }
  | { kind: "provider_error"; message: string };
```

Exceptions are reserved for programmer errors (invalid transitions attempted) — those *should* crash the request.

---

## 5. Architecture Layers

We separate the state machine (pure) from I/O (payments, DB) from transport (tRPC) from UI. This is what makes the state machine unit-testable without spinning up NeonDB.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  UI (Next.js App Router)                                                     │
│  src/app/**/*.tsx  +  <ComponentName>Doc.md                                  │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ tRPC hooks (React Query cache)
┌──────────────────────────────▼───────────────────────────────────────────────┐
│  API layer — tRPC router                                                     │
│  src/server/api/routers/orders.ts                                            │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────────────────┐
│  Service (orchestrator) — OrderService                                       │
│  src/server/domain/orderService.ts                                           │
│  Composes: OrderRepository + PaymentGateway + pure state machine             │
└─────┬────────────────────┬────────────────────────────────┬──────────────────┘
      │                    │                                │
      ▼                    ▼                                ▼
┌──────────────┐   ┌──────────────────────┐   ┌──────────────────────────────┐
│ Pure state   │   │ PaymentGateway       │   │ OrderRepository              │
│ machine      │   │ (interface + stub)   │   │ (Drizzle-backed + in-memory) │
│ orderState.ts│   │ paymentGateway.ts    │   │ orderRepository.ts           │
└──────────────┘   └──────────────────────┘   └──────────────────────────────┘
```

**Rule of dependencies:** arrows point *up* toward pure code. `orderState.ts` imports nothing from the DB, tRPC, or React. `OrderService` depends on interfaces (`PaymentGateway`, `OrderRepository`), which is why we can swap in `StubPaymentGateway` / `InMemoryOrderRepository` in tests.

---

## 6. File Structure

Every code file has a sibling `NameDoc.md`. Doc files are omitted from this tree except where they demonstrate the pattern.

```
gametime/
├── .github/
│   └── workflows/
│       └── ci.yml                            # type-check + lint + jest + build
├── cypress/
│   ├── e2e/
│   │   └── orders/
│   │       ├── happy-path.cy.ts
│   │       ├── payment-decline.cy.ts
│   │       ├── completion-fail-void-ok.cy.ts
│   │       ├── completion-fail-void-fail.cy.ts
│   │       └── needs-attention-resolve.cy.ts
│   ├── support/
│   │   ├── commands.ts
│   │   ├── e2e.ts
│   │   └── page-objects/
│   │       └── orderDetailPage.ts
│   └── cypressDoc.md                         # explains harness + how to run
├── docs/
│   ├── plans/
│   │   └── order-state-machine-plan.md      # THIS FILE
│   ├── features/
│   │   └── orderStateMachineMasterDoc.md    # feature-level walkthrough
│   ├── decisions/
│   │   ├── 0001-tech-stack.md               # ADR: why Next+tRPC+Drizzle+Neon
│   │   ├── 0002-state-modeling.md           # ADR: pure module vs XState
│   │   ├── 0003-branded-types.md            # ADR: Zod brand vs plain string
│   │   └── 0004-error-handling.md           # ADR: Result<T,E> vs exceptions
│   └── ai/
│       └── AI_USAGE.md                      # per Gametime's request
├── drizzle/                                  # generated migrations
│   ├── 0000_init.sql
│   └── meta/
├── public/
├── scripts/
│   └── seed.ts                              # one sample order for manual demo
├── src/
│   ├── app/
│   │   ├── layout.tsx                       # + layoutDoc.md
│   │   ├── page.tsx                         # orders list  (+ pageDoc.md)
│   │   ├── globals.css
│   │   ├── providers.tsx                    # tRPC + React Query provider
│   │   ├── orders/
│   │   │   └── [orderId]/
│   │   │       ├── page.tsx                 # thin route → OrderDetailContent
│   │   │       ├── pageDoc.md
│   │   │       └── components/
│   │   │           ├── OrderDetailContent.tsx
│   │   │           ├── OrderDetailContentDoc.md
│   │   │           ├── StateBadge.tsx
│   │   │           ├── StateBadgeDoc.md
│   │   │           ├── StateHistoryTable.tsx
│   │   │           ├── StateHistoryTableDoc.md
│   │   │           ├── AdvanceControls.tsx
│   │   │           └── AdvanceControlsDoc.md
│   │   ├── components/
│   │   │   ├── OrderCard.tsx
│   │   │   ├── OrderCardDoc.md
│   │   │   ├── EmptyState.tsx
│   │   │   └── EmptyStateDoc.md
│   │   └── api/
│   │       └── trpc/
│   │           └── [trpc]/
│   │               └── route.ts             # tRPC fetch adapter mount
│   ├── server/
│   │   ├── api/
│   │   │   ├── root.ts                      # + rootDoc.md
│   │   │   ├── trpc.ts                      # context + procedure builders
│   │   │   └── routers/
│   │   │       ├── orders.ts
│   │   │       └── ordersDoc.md
│   │   ├── db/
│   │   │   ├── index.ts                     # Neon client + drizzle instance
│   │   │   ├── indexDoc.md
│   │   │   ├── schema.ts                    # orders + orderStateHistory tables
│   │   │   └── schemaDoc.md
│   │   ├── domain/
│   │   │   ├── types.ts                     # branded types, Result, OrderState
│   │   │   ├── typesDoc.md
│   │   │   ├── orderState.ts                # PURE state machine
│   │   │   ├── orderStateDoc.md
│   │   │   ├── orderService.ts              # orchestrator
│   │   │   └── orderServiceDoc.md
│   │   ├── payments/
│   │   │   ├── paymentGateway.ts            # interface
│   │   │   ├── paymentGatewayDoc.md
│   │   │   ├── stubPaymentGateway.ts        # programmable test double
│   │   │   └── stubPaymentGatewayDoc.md
│   │   └── repositories/
│   │       ├── orderRepository.ts           # OrderRepository interface + Drizzle impl
│   │       ├── orderRepositoryDoc.md
│   │       ├── inMemoryOrderRepository.ts   # test double
│   │       └── inMemoryOrderRepositoryDoc.md
│   ├── trpc/
│   │   ├── react.tsx                        # client-side tRPC React helper
│   │   ├── reactDoc.md
│   │   ├── server.ts                        # server-side caller for RSC
│   │   └── serverDoc.md
│   └── env.mjs                              # zod-validated env
├── tests/
│   ├── orderState.test.ts                   # required unit tests live here
│   ├── orderService.test.ts                 # orchestrator scenarios
│   ├── stubPaymentGateway.test.ts
│   ├── inMemoryOrderRepository.test.ts
│   └── testsDoc.md                          # what each test file covers, why
├── .env.example
├── .env.local                               # gitignored (Neon URL)
├── .gitignore
├── .prettierrc
├── cypress.config.ts
├── drizzle.config.ts
├── eslint.config.mjs
├── jest.config.ts
├── jest.setup.ts
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── README.md                                # what/why/how-to-run/tradeoffs/future
├── tailwind.config.ts
└── tsconfig.json
```

---

## 7. Database Design

Two tables. Postgres via Neon.

### 7.1 `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, default `gen_random_uuid()` | Branded `OrderId` in TS |
| `state` | `text` (enum-checked via `pgEnum`) | Current state |
| `amount_cents` | `integer` | Order total |
| `payment_intent_id` | `text` nullable | Set once payment is authorized |
| `void_error` | `text` nullable | Populated only when void fails (needs_attention) |
| `created_at` | `timestamptz` default `now()` | |
| `updated_at` | `timestamptz` default `now()` | Updated on every state change |

### 7.2 `order_state_history`

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `order_id` | `uuid` FK → `orders.id`, index | |
| `from_state` | `text` nullable | `null` on the very first "initialized" row |
| `to_state` | `text` | |
| `event_type` | `text` | The `AdvanceEvent.type` that caused the transition |
| `metadata` | `jsonb` `.$type<Record<string, unknown>>()` | Payment errors, void errors, etc. |
| `occurred_at` | `timestamptz` default `now()`, index | |

**Why two tables:**
- Assessment explicitly requires "state history with timestamps" — a dedicated history table is the honest shape (never lose an event, cheap to query).
- Keeps the `orders` row as the single source of truth for *current* state (fast reads on the list page).

**Why `pgEnum` for state:** compile-time + runtime + DB-level validation triangulate. If we ever type a state literal wrong, one of the three catches it.

---

## 8. State Machine Design

### 8.1 Sequence — happy path

```
UI                     tRPC                 OrderService         PaymentGateway       Repo
 │  create              │                       │                       │              │
 │─────────────────────►│                       │                       │              │
 │                      │──── create() ────────►│                       │              │
 │                      │                       │──── insert() ────────►│              │
 │                      │◄────── order ─────────│                       │              │
 │◄─────  order ────────│                       │                       │              │
 │  advance(authorize)  │                       │                       │              │
 │─────────────────────►│                       │                       │              │
 │                      │─── advance() ────────►│                       │              │
 │                      │                       │─── authorize() ──────►│              │
 │                      │                       │◄──── { ok, id } ──────│              │
 │                      │                       │─── update+history ────────────────►│  │
 │                      │◄── order (auth'd) ────│                       │              │
 │  advance(complete)   │                       │                       │              │
 │─────────────────────►│                       │                       │              │
 │                      │─── advance() ────────►│                       │              │
 │                      │                       │─── update+history ────────────────►│  │
 │                      │◄── order (complete) ──│                       │              │
```

### 8.2 Failure branches

| Scenario | UI event | Payment call | Repo write | Terminal state |
|---|---|---|---|---|
| Payment decline | `advance(authorize)` | `authorize()` → `{ ok: false, kind: "declined" }` | `state=rejected`, history row with `metadata.reason` | `rejected` |
| Complete OK | `advance(complete)` | (none) | `state=complete` | `complete` |
| Complete fails, void OK | `advance(complete)` — simulated fail | `void()` → ok | `state=cancelled`, history row with `metadata.completeError` | `cancelled` |
| Complete fails, void fails | `advance(complete)` — simulated fail | `void()` → err | `state=needs_attention`, `void_error` set, history row with both errors | `needs_attention` |
| Manual resolve | `advance(resolve_manual)` | (none) | `state=cancelled` from `needs_attention` | `cancelled` |

**How does completion "fail"?** Since we have no real fulfillment system, the `OrderService.completeOrder()` accepts an *injected outcome* in tests, and in the running API it fails when the caller passes `?simulateFailure=1` on the tRPC input. This is the honest way to demo failure paths without inventing a fake ticket-issuance service. Documented in `orderServiceDoc.md`.

### 8.3 Invariant enforcement

The pure `applyTransition(current, next)` function:
1. Looks up `transitions[current]` — if `next` isn't in it, returns `{ ok: false, error: "invalid_transition" }`.
2. Otherwise returns `{ ok: true, value: next }`.

There is no "escape hatch." `OrderService` calls this on every advance. Every write to the DB is preceded by a successful `applyTransition` call.

---

## 9. API Design (tRPC)

Namespace: `orders.*`. All inputs are Zod schemas; all outputs are typed by inference.

| Procedure | Kind | Input | Behavior |
|---|---|---|---|
| `orders.create` | mutation | `{ amountCents: number }` | Insert order in `initialized`. Returns full order. |
| `orders.advance` | mutation | `{ orderId, event: AdvanceEvent, simulateCompletionFailure?, simulateVoidFailure? }` | Calls `OrderService.advance`. Returns updated order + latest history row. Simulation flags exist only to trigger failure paths from the UI/tests. |
| `orders.get` | query | `{ orderId }` | Returns order + full history array. |
| `orders.list` | query | `{ limit?: number = 50 }` | Returns recent orders (list page). |

### Why simulation flags exist

The assessment says "Stub payment as an interface." We do that, but the *completion* step also needs a way to fail on demand for the "completion failure" test cases. Rather than invent a fake fulfillment service, the tRPC input carries opt-in failure flags. In tests, they're triggered explicitly. In the UI, the advance controls expose them behind clearly-labeled dev buttons (`Simulate: completion fails` and `Simulate: completion + void fail`). Called out in `AdvanceControlsDoc.md` so the interviewer sees the intent.

---

## 10. UI Design

Minimal but honest. Enough to demo every failure path in a browser.

### 10.1 Pages

| Route | Component | Purpose |
|---|---|---|
| `/` | `<OrdersListContent />` | Shows recent orders as cards. "New order" button. |
| `/orders/[orderId]` | `<OrderDetailContent />` | Current state badge + history table + advance controls. |

### 10.2 Advance controls

Buttons rendered based on current state (mirrors `transitions[current]`):

| Current state | Buttons |
|---|---|
| `initialized` | `Authorize payment` (success) · `Authorize (decline)` |
| `payment_authorized` | `Complete order` · `Simulate: completion fails (void OK)` · `Simulate: completion + void fail` |
| `needs_attention` | `Manually resolve → cancelled` |
| `complete` / `rejected` / `cancelled` | (none — terminal) |

### 10.3 Visual

- State badge colors:
  - `initialized` → gray
  - `payment_authorized` → blue
  - `complete` → green
  - `rejected` → red
  - `cancelled` → amber
  - `needs_attention` → red-outlined, pulsing (this one is *deliberately loud* — the whole point of the state is "don't silently swallow")

---

## 11. TypeScript Best Practices (Matt Pocock playbook)

Each of these is applied deliberately and documented in the relevant `NameDoc.md` with the *reason*.

### 11.1 Branded types
See §4.4. Zod's `.brand()` gives compile-time distinctness AND runtime validation from a single source.

### 11.2 `as const` + literal unions
```ts
export const orderStates = [
  "initialized", "payment_authorized", "complete",
  "rejected", "cancelled", "needs_attention",
] as const;
export type OrderState = typeof orderStates[number];
```
Adding a state means editing the array — `OrderState` updates automatically.

### 11.3 `satisfies` operator
```ts
export const transitions = { ... } as const satisfies Record<OrderState, readonly OrderState[]>;
```
Enforces we cover every state without widening the value's literal types.

### 11.4 Discriminated unions + exhaustive `never` checks
```ts
function handle(event: AdvanceEvent) {
  switch (event.type) {
    case "authorize_payment": return ...;
    case "complete_order":    return ...;
    case "resolve_manual":    return ...;
    default: return assertNever(event); // compile error if a case is missed
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
```

### 11.5 Zod as source of truth
Every tRPC input has a Zod schema; the TS type is `z.infer<typeof schema>`. No hand-written duplicate types.

### 11.6 `type` over `interface`
Domain modeling uses `type`. Reserved `interface` for cases where declaration merging is useful (none in this project).

### 11.7 Never `any`
`unknown` at boundaries, narrow explicitly. `error: unknown` in catch clauses.

### 11.8 `noUncheckedIndexedAccess`
`tsconfig.json` has this on. `arr[0]` is `T | undefined` — forces us to handle the empty case (relevant for `history.at(-1)` lookups).

### 11.9 Template literal types (where useful)
Currently only used for CSS class names in the state badge component (`\`bg-${Color}-500\`` typed variants). Not stretched further — templates are a tool, not a mandate.

### 11.10 Result type vs exceptions
See §4.6. Domain-meaningful failures return `Result<T, E>`; invariant violations throw.

---

## 12. Documentation Standard

Every code file gets a sibling `<Name>Doc.md` (Squiresolutions convention). The doc must let a cold reader — including the interviewer — follow *why*, not just *what*.

### 12.1 Per-file `NameDoc.md` template

```markdown
# <Human-readable name>

## Overview
One paragraph, plain English: what this file does and its role in the system.

**Location:** `src/…/foo.ts`

## Why this file exists
Which problem it solves. What it would take to remove it (usually: nothing else in the app knows how to do this job).

## Key decisions
- **Branded `OrderId`** — used because [reason]. Alternative considered: plain `string`; rejected because [reason].
- **Discriminated union `AdvanceEvent`** — used because [reason].
- **`as const satisfies`** — used because [reason].

## Types
```ts
// pasted verbatim from the file, with 1-line comments where non-obvious
```

## Public surface
| Export | Kind | Purpose |
|---|---|---|
| `applyTransition` | fn | Pure. Given (from, to) returns Result. |
| `transitions`    | const | Transition matrix. |

## Related files
- `src/server/domain/orderServiceDoc.md` — the orchestrator that calls into this file.
- `tests/orderState.test.ts` — exhaustive transition tests.

## Testing notes
Jest coverage requirements for this file. Edge cases that matter.
```

### 12.2 Master feature doc

`docs/features/orderStateMachineMasterDoc.md` is the top-level walkthrough — links to every `NameDoc.md`, contains the diagrams from §5 and §8, and answers the README's "how it works" question in depth.

### 12.3 ADRs (Architecture Decision Records)

`docs/decisions/0001…0004.md` — each captures a single decision with **Context / Decision / Consequences / Alternatives considered**. These are for the panel round 2 (Architecture) — Dallin can point at them when asked "why did you pick X."

### 12.4 AI usage log

`docs/ai/AI_USAGE.md` per the recruiter's ask. Each entry: **what we asked / what AI produced / how we validated / what we kept vs changed**. Updated as we go, not backfilled.

---

## 13. Testing Strategy

### 13.1 Jest — unit tests (pure, fast)

Located in `tests/`. No DB, no network. Uses `StubPaymentGateway` + `InMemoryOrderRepository`.

**Required by the assessment:**
1. Happy path: `create → authorize → complete` — final state `complete`, history has 3 rows.
2. Payment decline — `authorize` fails → state `rejected`, history has 2 rows (init + rejected).
3. Completion failure with successful void — `authorize` OK, `complete` fails, `void` OK → state `cancelled`, `metadata.completeError` recorded.
4. Completion failure with failed void — both fail → state `needs_attention`, `metadata.completeError` AND `metadata.voidError` both recorded, order has `voidError` field populated.

**We'll add (worth having):**
5. Invalid transition attempts throw (e.g. can't advance a `complete` order).
6. Terminal states reject all events.
7. `needs_attention → cancelled` via `resolve_manual`.
8. `transitions` matrix exhaustively covers every state (property-style test).
9. Idempotency: calling `advance` with the same event twice on a terminal state returns a clean error, doesn't corrupt history.
10. Branded-type Zod schemas reject wrong-shape inputs at the boundary.

### 13.2 Cypress — E2E (UI + API together)

Located in `cypress/e2e/orders/`. Runs against a local Next dev server pointing at a NeonDB branch (or the same DB with a namespace prefix on ids).

| Test | What it verifies |
|---|---|
| `happy-path.cy.ts` | Create → authorize → complete via the UI; badge turns green; history table has 3 rows. |
| `payment-decline.cy.ts` | Create → "Authorize (decline)" → badge red; history shows decline reason. |
| `completion-fail-void-ok.cy.ts` | Create → authorize → "Simulate: completion fails (void OK)" → badge amber; history shows both events. |
| `completion-fail-void-fail.cy.ts` | Same but "…+ void fail" → badge red-outlined-pulsing; page shows `voidError`. |
| `needs-attention-resolve.cy.ts` | From needs_attention → click "Manually resolve → cancelled" → badge amber. |

### 13.3 Coverage target

- Pure state machine (`orderState.ts`): **100% branch coverage** — it's ~30 lines, this is easy and worth it.
- `orderService.ts`: cover every branch of the failure matrix (§8.2).
- Everything else: enough to prove correctness, not gaming coverage %.

---

## 14. AI Usage Log Approach

Per Gametime's recruiter email: *"document where and why you used [AI], and how you validated or challenged the outputs."*

We'll keep `docs/ai/AI_USAGE.md` updated as we go — not backfilled. Each entry:

```markdown
## <YYYY-MM-DD HH:MM> — <what was being built>

**Prompt (paraphrased):** "…"

**AI output (paraphrased or code diff):** …

**Validation:**
- Ran <test> — passed / failed.
- Cross-checked against <docs / existing pattern> — matches / diverges.
- Manually tested <flow> in the browser.

**Kept / changed / discarded:** …
```

This is honest, credible, and directly answers the recruiter's ask.

---

## 15. Implementation Phases

Maps 1:1 to the tasks created for this project. Each phase ends with a git commit + all tests green.

### Phase 0 — Scaffold
- `npx create-next-app@latest gametime --typescript --tailwind --eslint --app --src-dir --import-alias "~/*" --use-npm` (or equivalent)
- Add deps: `@trpc/server @trpc/client @trpc/react-query @trpc/next @tanstack/react-query zod drizzle-orm drizzle-kit @neondatabase/serverless @t3-oss/env-nextjs`
- Dev deps: `jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom cypress start-server-and-test`
- Configure `tsconfig.json` with `"strict": true, "noUncheckedIndexedAccess": true`
- Configure `.env.local` (Neon URL, gitignored)
- Verify `npm run build` passes on empty scaffold.

### Phase 1 — DB schema + migration
- Write `src/server/db/schema.ts` with `orders` + `orderStateHistory` + `pgEnum` for state.
- `drizzle-kit generate` → commits SQL to `drizzle/`.
- `drizzle-kit push` to NeonDB.
- Write `schemaDoc.md`.

### Phase 2 — Pure state machine + Jest tests
- `src/server/domain/types.ts` — branded types, `OrderState`, `AdvanceEvent`, `Result`, `PaymentError`.
- `src/server/domain/orderState.ts` — `transitions` const, `applyTransition`, `isTerminal`, `nextStates`.
- `tests/orderState.test.ts` — every transition + invariant.
- `typesDoc.md`, `orderStateDoc.md`, `testsDoc.md`.

### Phase 3 — PaymentGateway interface + stub
- `src/server/payments/paymentGateway.ts` — interface + `PaymentAuthorization` shape.
- `src/server/payments/stubPaymentGateway.ts` — programmable stub (queue of scripted outcomes).
- `tests/stubPaymentGateway.test.ts` — verify stub behaves as documented.
- `paymentGatewayDoc.md`, `stubPaymentGatewayDoc.md`.

### Phase 4 — Order service (orchestrator) + tests
- `src/server/repositories/orderRepository.ts` — interface + Drizzle impl.
- `src/server/repositories/inMemoryOrderRepository.ts` — test double.
- `src/server/domain/orderService.ts` — `create`, `advance`, `get`, `list`. Handles all failure paths.
- `tests/orderService.test.ts` — the four required scenarios + additions.
- Docs for each file.

### Phase 5 — tRPC router
- `src/server/api/trpc.ts` — context, procedure builders.
- `src/server/api/routers/orders.ts` — the 4 procedures from §9.
- `src/server/api/root.ts` — mount router.
- `src/app/api/trpc/[trpc]/route.ts` — fetch adapter.
- `src/trpc/react.tsx` + `src/trpc/server.ts` — client + server helpers.
- `ordersDoc.md`, `rootDoc.md`, `reactDoc.md`, `serverDoc.md`.

### Phase 6 — UI
- `src/app/page.tsx` — orders list.
- `src/app/orders/[orderId]/page.tsx` + `OrderDetailContent` + subcomponents.
- Tailwind styling.
- Docs per component.

### Phase 7 — Cypress E2E
- `cypress.config.ts`, `cypress/support/*`.
- The 5 e2e specs from §13.2.
- `cypressDoc.md`.

### Phase 8 — README + AI_USAGE + polish + submit
- `README.md` (see §16).
- Finalize `AI_USAGE.md`.
- `orderStateMachineMasterDoc.md` — feature-level walkthrough tying everything together.
- ADRs `0001-0004`.
- Push to GitHub, submit the link.

---

## 16. Deliverables Checklist

### Required by Gametime
- [ ] GitHub repo, public or invite-only.
- [ ] `README.md` covering:
  - [ ] What we built and why.
  - [ ] How to run (`npm install`, `.env.local` setup, `npm run dev`, `npm test`, `npx cypress open`).
  - [ ] Tradeoffs made (explicit "we chose a bigger stack, here's why").
  - [ ] What we'd do differently with more time (auth, idempotency keys, webhook retries, real payment provider, distributed lock on advance, event sourcing option).
- [ ] Documented AI use (`docs/ai/AI_USAGE.md`).
- [ ] Required unit tests: happy path, decline, completion-fail-void-ok, completion-fail-void-fail.

### Our own bar
- [ ] Every code file has a sibling `NameDoc.md`.
- [ ] `docs/features/orderStateMachineMasterDoc.md` exists and links every doc.
- [ ] ADRs 0001–0004.
- [ ] Cypress specs pass locally.
- [ ] `npm run typecheck && npm test && npm run build` all green.
- [ ] Deployed to Vercel with a link in the README (optional but nice; only if user approves).

---

## 17. Open Questions (need answers before Phase 0 starts)

1. **Do you approve the "bigger stack" tradeoff?** The assessment nudges toward a minimal solution. If you'd rather ship the minimal version AND a full extended version (two branches?), say so. My recommendation: one repo, the extended version, with the tradeoff called out in README.
2. **GitHub repo name?** e.g. `gametime-order-state-machine`, `gt-checkout-state`, or something you prefer?
3. **Deploy to Vercel?** Optional; makes the interviewer's life easier to click through. If yes, we'll use Neon's built-in Vercel integration.
4. **UI theme?** Default is a clean neutral Tailwind look — happy to match a specific Gametime brand color if you want.
5. **Simulation flags on the UI advance buttons — visible or hidden?** Current plan is visible (labeled "Simulate: …"), because the interviewer needs to trigger failure paths. Alternative is a query-param dev toggle. Recommend keeping them visible with clear labels.
6. **AI usage log — how transparent?** I'll log every meaningful AI call. If you'd rather curate it to a few highlights, say so.
7. **`needs_attention → cancelled` manual resolution — in scope?** The assessment doesn't ask for it, but modeling a semi-terminal state without a way out feels incomplete. Recommend keeping the manual resolve button + test. Say the word if you'd rather cut it.
8. **Testing config — separate NeonDB branch for Cypress?** Cleanest is a `test` Neon branch so E2E doesn't pollute dev data. Recommend yes if it's a couple of clicks.

---

## 18. Non-goals (explicitly out of scope)

- Real payment provider integration (Stripe, Adyen).
- Authentication / authorization.
- Multi-tenancy.
- Retry policies with exponential backoff.
- Idempotency keys on `create`.
- Webhook signature verification.
- Distributed locking for concurrent `advance` calls.
- Observability (Sentry, OTel, structured logs beyond `console`).
- Deployment to production.

These are all *legitimate* things to talk about in the Architecture panel round — we'll mention each in the README's "with more time" section so the interviewer knows we're aware of them.
