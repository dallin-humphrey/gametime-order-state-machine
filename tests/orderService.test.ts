/**
 * End-to-end tests for the OrderService orchestrator.
 *
 * These four `describe` blocks are the required scenarios from the
 * assessment PDF:
 *   1. Happy path — create → authorize → complete
 *   2. Payment decline
 *   3. Completion failure with successful void
 *   4. Completion failure with failed void
 *
 * Everything after that is invariant / edge-case coverage.
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "@jest/globals";

import { StubPaymentGateway } from "~/server/payments/stubPaymentGateway";
import { InMemoryOrderRepository } from "~/server/repositories/orderRepository";
import { OrderService } from "~/server/domain/orderService";
import {
  amountCentsSchema,
  err,
  ok,
  orderIdSchema,
  paymentIntentIdSchema,
  type Order,
  type OrderId,
} from "~/server/domain/types";

// ─── Test harness ────────────────────────────────────────────────────────────

function setup() {
  // Each test gets a fresh in-memory Map — no cross-test contamination.
  const repo = new InMemoryOrderRepository(new Map());
  const gateway = new StubPaymentGateway();
  const service = new OrderService(repo, gateway);
  return { repo, gateway, service };
}

const amount = amountCentsSchema.parse(1000);

function makeAuthOk(paymentIntentId = paymentIntentIdSchema.parse("pi_test")) {
  return ok({
    paymentIntentId,
    amountCents: amount,
    authorizedAt: new Date(),
  });
}

function makeVoidOk(paymentIntentId = paymentIntentIdSchema.parse("pi_test")) {
  return ok({
    paymentIntentId,
    voidedAt: new Date(),
  });
}

function last<T>(arr: readonly T[]): T {
  const value = arr.at(-1);
  if (value === undefined) {
    throw new Error(`last(): array of length ${arr.length} is empty`);
  }
  return value;
}

// ─── 1. Happy path ───────────────────────────────────────────────────────────

describe("OrderService — happy path", () => {
  it("create → authorize → complete", async () => {
    const { service, gateway } = setup();
    const paymentIntentId = paymentIntentIdSchema.parse("pi_happy");
    gateway.scriptAuthorize(makeAuthOk(paymentIntentId));

    const created: Order = service.create({ amountCents: amount });
    expect(created.state).toBe("initialized");
    expect(created.history).toHaveLength(1);
    expect(created.paymentIntentId).toBeNull();

    const authorized = await service.advance({
      orderId: created.id,
      event: { type: "authorize_payment" },
    });
    expect(authorized.state).toBe("payment_authorized");
    expect(authorized.paymentIntentId).toBe(paymentIntentId);
    expect(authorized.history).toHaveLength(2);

    const completed = await service.advance({
      orderId: created.id,
      event: { type: "complete_order" },
    });
    expect(completed.state).toBe("complete");
    expect(completed.history).toHaveLength(3);
    expect(completed.history.map((h) => h.toState)).toEqual([
      "initialized",
      "payment_authorized",
      "complete",
    ]);
  });
});

// ─── 2. Payment decline ──────────────────────────────────────────────────────

describe("OrderService — payment decline", () => {
  it("create → authorize (declined) → rejected", async () => {
    const { service, gateway } = setup();
    gateway.scriptAuthorize(
      err({ kind: "declined", reason: "insufficient_funds" }),
    );

    const created = service.create({ amountCents: amount });
    const rejected = await service.advance({
      orderId: created.id,
      event: { type: "authorize_payment" },
    });

    expect(rejected.state).toBe("rejected");
    expect(rejected.paymentIntentId).toBeNull();
    expect(rejected.voidError).toBeNull();
    expect(rejected.history).toHaveLength(2);

    const lastEntry = last(rejected.history);
    expect(lastEntry.toState).toBe("rejected");
    expect(lastEntry.metadata.paymentError).toEqual({
      kind: "declined",
      reason: "insufficient_funds",
    });
  });
});

// ─── 3. Completion failure with successful void ──────────────────────────────

describe("OrderService — completion failure, void succeeds", () => {
  it("create → authorize → complete (fail) → void OK → cancelled", async () => {
    const { service, gateway } = setup();
    const paymentIntentId = paymentIntentIdSchema.parse("pi_cancelled");
    gateway.scriptAuthorize(makeAuthOk(paymentIntentId));
    gateway.scriptVoid(makeVoidOk(paymentIntentId));

    const created = service.create({ amountCents: amount });
    await service.advance({
      orderId: created.id,
      event: { type: "authorize_payment" },
    });
    const cancelled = await service.advance({
      orderId: created.id,
      event: { type: "complete_order" },
      simulateCompletionFailure: true,
    });

    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.voidError).toBeNull();
    expect(cancelled.history).toHaveLength(3);

    const lastEntry = last(cancelled.history);
    expect(lastEntry.toState).toBe("cancelled");
    expect(lastEntry.metadata.completionError).toEqual({
      kind: "provider_error",
      message: "Simulated completion failure",
    });
    expect(lastEntry.metadata.voidedAt).toBeInstanceOf(Date);

    // The gateway WAS called for the void (not simulated).
    expect(gateway.voidCalls).toHaveLength(1);
    expect(gateway.voidCalls[0]?.paymentIntentId).toBe(paymentIntentId);
  });
});

// ─── 4. Completion failure with failed void ──────────────────────────────────

describe("OrderService — completion failure, void fails", () => {
  it("create → authorize → complete (fail) → void (fail) → needs_attention", async () => {
    const { service, gateway } = setup();
    const paymentIntentId = paymentIntentIdSchema.parse("pi_stuck");
    gateway.scriptAuthorize(makeAuthOk(paymentIntentId));

    const created = service.create({ amountCents: amount });
    await service.advance({
      orderId: created.id,
      event: { type: "authorize_payment" },
    });
    const stuck = await service.advance({
      orderId: created.id,
      event: { type: "complete_order" },
      simulateCompletionFailure: true,
      simulateVoidFailure: true,
    });

    expect(stuck.state).toBe("needs_attention");
    expect(stuck.voidError).toContain("network_error");
    expect(stuck.voidError).toContain("Simulated void failure");
    expect(stuck.history).toHaveLength(3);

    const lastEntry = last(stuck.history);
    expect(lastEntry.toState).toBe("needs_attention");
    expect(lastEntry.metadata.completionError).toEqual({
      kind: "provider_error",
      message: "Simulated completion failure",
    });
    expect(lastEntry.metadata.voidError).toEqual({
      kind: "network_error",
      cause: "Simulated void failure",
    });

    // simulateVoidFailure short-circuits the gateway — it must NOT be called.
    expect(gateway.voidCalls).toHaveLength(0);
  });
});

// ─── Additional invariants ───────────────────────────────────────────────────

describe("OrderService — manual resolve", () => {
  it("needs_attention → cancelled clears voidError", async () => {
    const { service, gateway } = setup();
    const paymentIntentId = paymentIntentIdSchema.parse("pi_resolve");
    gateway.scriptAuthorize(makeAuthOk(paymentIntentId));

    const created = service.create({ amountCents: amount });
    await service.advance({
      orderId: created.id,
      event: { type: "authorize_payment" },
    });
    await service.advance({
      orderId: created.id,
      event: { type: "complete_order" },
      simulateCompletionFailure: true,
      simulateVoidFailure: true,
    });

    const resolved = await service.advance({
      orderId: created.id,
      event: { type: "resolve_manual" },
    });

    expect(resolved.state).toBe("cancelled");
    expect(resolved.voidError).toBeNull();
    expect(resolved.history).toHaveLength(4);
    expect(last(resolved.history).eventType).toBe("resolve_manual");
  });
});

describe("OrderService — illegal moves throw", () => {
  it("advancing a terminal (rejected) order throws", async () => {
    const { service, gateway } = setup();
    gateway.scriptAuthorize(err({ kind: "declined", reason: "test" }));
    const created = service.create({ amountCents: amount });
    await service.advance({
      orderId: created.id,
      event: { type: "authorize_payment" },
    });
    // Now rejected. Try again.
    gateway.scriptAuthorize(makeAuthOk());
    await expect(
      service.advance({
        orderId: created.id,
        event: { type: "authorize_payment" },
      }),
    ).rejects.toThrow(/illegal transition/i);
  });

  it("advancing an unknown order id throws", async () => {
    const { service } = setup();
    const unknownId: OrderId = orderIdSchema.parse(randomUUID());
    await expect(
      service.advance({
        orderId: unknownId,
        event: { type: "authorize_payment" },
      }),
    ).rejects.toThrow(/not found/);
  });

  it("resolve_manual from a non-needs_attention state throws", async () => {
    const { service } = setup();
    const created = service.create({ amountCents: amount });
    await expect(
      service.advance({
        orderId: created.id,
        event: { type: "resolve_manual" },
      }),
    ).rejects.toThrow(/illegal transition/i);
  });
});

describe("OrderService — reads", () => {
  it("get returns null for unknown id", () => {
    const { service } = setup();
    const unknownId = orderIdSchema.parse(randomUUID());
    expect(service.get(unknownId)).toBeNull();
  });

  it("list returns most-recent-first", () => {
    const { service } = setup();
    const first = service.create({ amountCents: amount });
    const second = service.create({ amountCents: amount });
    const listed = service.list();
    expect(listed).toHaveLength(2);
    expect(listed[0]?.id).toBe(second.id);
    expect(listed[1]?.id).toBe(first.id);
  });

  it("list respects the limit", () => {
    const { service } = setup();
    service.create({ amountCents: amount });
    service.create({ amountCents: amount });
    service.create({ amountCents: amount });
    expect(service.list(2)).toHaveLength(2);
  });
});
