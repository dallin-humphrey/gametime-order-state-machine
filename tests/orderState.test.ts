/**
 * Tests for the pure state machine.
 *
 * These tests exercise `src/server/domain/orderState.ts` end-to-end without
 * touching the DB, HTTP, or the payment gateway. They also exercise the Zod
 * branded schemas in `types.ts` so a Zod version bump that changes the API
 * (e.g. `.uuid()` moves) surfaces here immediately.
 *
 * The four scenarios the assessment REQUIRES are covered by the transition
 * legality tests below. End-to-end orchestration (payment + repo + state
 * machine) is covered in `tests/orderService.test.ts` once Phases 2-3 land.
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "@jest/globals";

import {
  applyTransition,
  isTerminal,
  nextStates,
  transitions,
} from "~/server/domain/orderState";
import {
  amountCentsSchema,
  orderIdSchema,
  orderStates,
  paymentIntentIdSchema,
} from "~/server/domain/types";

describe("transition matrix invariants", () => {
  it("covers every OrderState as a key", () => {
    for (const state of orderStates) {
      expect(transitions).toHaveProperty(state);
    }
  });

  it("only lists legal states as successors", () => {
    for (const successors of Object.values(transitions)) {
      for (const successor of successors) {
        expect(orderStates).toContain(successor);
      }
    }
  });

  it("terminal states (complete / rejected / cancelled) have no successors", () => {
    expect(transitions.complete).toEqual([]);
    expect(transitions.rejected).toEqual([]);
    expect(transitions.cancelled).toEqual([]);
  });

  it("needs_attention retains one successor (cancelled) for manual resolution", () => {
    expect(transitions.needs_attention).toEqual(["cancelled"]);
  });
});

describe("applyTransition — happy path", () => {
  it("initialized → payment_authorized", () => {
    const result = applyTransition("initialized", "payment_authorized");
    expect(result).toEqual({ ok: true, value: "payment_authorized" });
  });

  it("payment_authorized → complete", () => {
    const result = applyTransition("payment_authorized", "complete");
    expect(result).toEqual({ ok: true, value: "complete" });
  });
});

describe("applyTransition — failure-path transitions are legal", () => {
  it.each([
    ["initialized", "rejected"],
    ["payment_authorized", "cancelled"],
    ["payment_authorized", "needs_attention"],
    ["needs_attention", "cancelled"],
  ] as const)("%s → %s is allowed", (from, to) => {
    const result = applyTransition(from, to);
    expect(result).toEqual({ ok: true, value: to });
  });
});

describe("applyTransition — illegal moves are refused", () => {
  it("initialized → complete (skips authorization) is refused", () => {
    const result = applyTransition("initialized", "complete");
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });

  it("initialized → cancelled (no payment to void) is refused", () => {
    const result = applyTransition("initialized", "cancelled");
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });

  it("initialized → needs_attention (no payment to fail on) is refused", () => {
    const result = applyTransition("initialized", "needs_attention");
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });

  it("payment_authorized → rejected (decline is only reachable from initialized) is refused", () => {
    const result = applyTransition("payment_authorized", "rejected");
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });

  it.each(orderStates)("complete → %s is refused (terminal)", (target) => {
    const result = applyTransition("complete", target);
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });

  it.each(orderStates)("cancelled → %s is refused (terminal)", (target) => {
    const result = applyTransition("cancelled", target);
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });

  it.each(orderStates)("rejected → %s is refused (terminal)", (target) => {
    const result = applyTransition("rejected", target);
    expect(result).toEqual({ ok: false, error: "invalid_transition" });
  });
});

describe("nextStates", () => {
  it("returns the matrix entry for initialized", () => {
    expect(nextStates("initialized")).toEqual([
      "payment_authorized",
      "rejected",
    ]);
  });

  it("returns the matrix entry for payment_authorized", () => {
    expect(nextStates("payment_authorized")).toEqual([
      "complete",
      "cancelled",
      "needs_attention",
    ]);
  });

  it("returns [] for terminal states", () => {
    expect(nextStates("complete")).toEqual([]);
    expect(nextStates("rejected")).toEqual([]);
    expect(nextStates("cancelled")).toEqual([]);
  });

  it("returns [cancelled] for needs_attention (manual resolution path)", () => {
    expect(nextStates("needs_attention")).toEqual(["cancelled"]);
  });
});

describe("isTerminal", () => {
  it.each(["complete", "rejected", "cancelled"] as const)(
    "%s is terminal",
    (state) => {
      expect(isTerminal(state)).toBe(true);
    },
  );

  it("needs_attention is NOT terminal — manual resolve is still legal", () => {
    expect(isTerminal("needs_attention")).toBe(false);
  });

  it("initialized and payment_authorized are not terminal", () => {
    expect(isTerminal("initialized")).toBe(false);
    expect(isTerminal("payment_authorized")).toBe(false);
  });
});

describe("Zod branded schemas", () => {
  it("orderIdSchema accepts a valid UUID", () => {
    const uuid = randomUUID();
    expect(orderIdSchema.parse(uuid)).toBe(uuid);
  });

  it("orderIdSchema rejects non-UUID strings", () => {
    expect(() => orderIdSchema.parse("not-a-uuid")).toThrow();
  });

  it("paymentIntentIdSchema accepts a non-empty string", () => {
    expect(paymentIntentIdSchema.parse("pi_abc123")).toBe("pi_abc123");
  });

  it("paymentIntentIdSchema rejects an empty string", () => {
    expect(() => paymentIntentIdSchema.parse("")).toThrow();
  });

  it("amountCentsSchema accepts a non-negative integer", () => {
    expect(amountCentsSchema.parse(1000)).toBe(1000);
    expect(amountCentsSchema.parse(0)).toBe(0);
  });

  it("amountCentsSchema rejects a negative integer", () => {
    expect(() => amountCentsSchema.parse(-1)).toThrow();
  });

  it("amountCentsSchema rejects a float", () => {
    expect(() => amountCentsSchema.parse(10.5)).toThrow();
  });
});
