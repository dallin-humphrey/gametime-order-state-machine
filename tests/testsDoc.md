# Test Suite Overview

## Location

`tests/` — one file per production module. Each test file has a sibling `NameDoc.md` next to the code it tests.

## Coverage map

| Test file | Under test | Focus |
|---|---|---|
| [`orderState.test.ts`](./orderState.test.ts) | `src/server/domain/orderState.ts` + Zod schemas | Pure transition matrix, `applyTransition`, `nextStates`, `isTerminal`, branded-schema parsing. 100% branch coverage target. |
| `orderService.test.ts` *(Phase 3)* | `src/server/domain/orderService.ts` | The four required end-to-end scenarios: happy path, decline, complete-fail-void-ok, complete-fail-void-fail. |
| `stubPaymentGateway.test.ts` *(Phase 2)* | `src/server/payments/stubPaymentGateway.ts` | Programmable-outcomes queue behaves as documented. |
| `inMemoryOrderRepository.test.ts` *(Phase 3)* | `src/server/repositories/inMemoryOrderRepository.ts` | Persistence + history append + `globalThis` singleton semantics. |

## Conventions

- **One `describe` per behavior area.** `applyTransition — illegal moves are refused` reads like a sentence.
- **`it` names read as sentences.** `"initialized → complete (skips authorization) is refused"`.
- **Result narrowing, not `!` assertions.** `expect(r).toEqual({ ok: true, value: "..." })` — no non-null bangs.
- **Test doubles are real classes.** `StubPaymentGateway` implements `PaymentGateway`; `InMemoryOrderRepository` implements `OrderRepository`. No `jest.mock` of production types.
- **`it.each` for sweeps.** Every OrderState × every illegal target is covered by an `.each` rather than one hand-written test per pair.

## Running

```bash
npm test              # once
npm run test:watch    # re-runs on change
npm run test:coverage # with coverage report
```

## What "the four required tests" means

The assessment names four scenarios by name. Here's where each lives:

| Scenario | File | Test |
|---|---|---|
| Happy path | `orderState.test.ts` + `orderService.test.ts` (Phase 3) | `initialized → payment_authorized → complete` |
| Payment decline | `orderState.test.ts` + `orderService.test.ts` (Phase 3) | `initialized → rejected` on gateway `declined` |
| Completion failure with successful void | `orderService.test.ts` (Phase 3) | `payment_authorized → cancelled` after simulated completion failure + successful `void()` |
| Completion failure with failed void | `orderService.test.ts` (Phase 3) | `payment_authorized → needs_attention` after simulated completion failure + failing `void()` |

`orderState.test.ts` covers the transition legality of every path. `orderService.test.ts` (Phase 3) will cover the orchestration — payment call outcomes, history metadata capture, `voidError` field population.
