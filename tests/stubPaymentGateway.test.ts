/**
 * Tests for StubPaymentGateway.
 *
 * The stub is a test double, but it earns its own test file because Phase 3
 * tests will depend on its FIFO ordering, its "empty queue throws" guarantee,
 * and its call-recording. If any of those regress, we want the failure to
 * point here rather than at the service test.
 */
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "@jest/globals";

import type {
  AuthorizeInput,
  PaymentAuthorization,
  PaymentVoid,
} from "~/server/payments/paymentGateway";
import { StubPaymentGateway } from "~/server/payments/stubPaymentGateway";
import {
  amountCentsSchema,
  err,
  ok,
  orderIdSchema,
  paymentIntentIdSchema,
  type PaymentError,
  type Result,
} from "~/server/domain/types";

function makeAuthorizeInput(): AuthorizeInput {
  return {
    orderId: orderIdSchema.parse(randomUUID()),
    amountCents: amountCentsSchema.parse(1000),
    paymentMethodToken: "pm_test",
  };
}

function makeVoidInput() {
  return {
    paymentIntentId: paymentIntentIdSchema.parse(`pi_${randomUUID()}`),
  };
}

function makeAuthOk(): Result<PaymentAuthorization, PaymentError> {
  return ok({
    paymentIntentId: paymentIntentIdSchema.parse(`pi_${randomUUID()}`),
    amountCents: amountCentsSchema.parse(1000),
    authorizedAt: new Date(),
  });
}

function makeVoidOk(): Result<PaymentVoid, PaymentError> {
  return ok({
    paymentIntentId: paymentIntentIdSchema.parse(`pi_${randomUUID()}`),
    voidedAt: new Date(),
  });
}

describe("StubPaymentGateway — authorize", () => {
  it("returns the scripted success outcome verbatim", async () => {
    const gw = new StubPaymentGateway();
    const scripted = makeAuthOk();
    gw.scriptAuthorize(scripted);

    const result = await gw.authorize(makeAuthorizeInput());

    expect(result).toEqual(scripted);
  });

  it("returns the scripted decline outcome verbatim", async () => {
    const gw = new StubPaymentGateway();
    gw.scriptAuthorize(err({ kind: "declined", reason: "test" }));

    const result = await gw.authorize(makeAuthorizeInput());

    expect(result).toEqual({
      ok: false,
      error: { kind: "declined", reason: "test" },
    });
  });

  it("returns outcomes in FIFO order", async () => {
    const gw = new StubPaymentGateway();
    const first = makeAuthOk();
    const second = err({ kind: "declined" as const, reason: "second" });
    gw.scriptAuthorize(first, second);

    expect(await gw.authorize(makeAuthorizeInput())).toEqual(first);
    expect(await gw.authorize(makeAuthorizeInput())).toEqual(second);
  });

  it("throws when called without a scripted outcome", async () => {
    const gw = new StubPaymentGateway();
    await expect(gw.authorize(makeAuthorizeInput())).rejects.toThrow(
      /without a scripted outcome/,
    );
  });

  it("records every call with the exact input for inspection", async () => {
    const gw = new StubPaymentGateway();
    gw.scriptAuthorize(makeAuthOk());
    const input = makeAuthorizeInput();

    await gw.authorize(input);

    expect(gw.authorizeCalls).toHaveLength(1);
    expect(gw.authorizeCalls[0]).toEqual(input);
  });
});

describe("StubPaymentGateway — voidPayment", () => {
  it("returns the scripted success outcome verbatim", async () => {
    const gw = new StubPaymentGateway();
    const scripted = makeVoidOk();
    gw.scriptVoid(scripted);

    const result = await gw.voidPayment(makeVoidInput());

    expect(result).toEqual(scripted);
  });

  it("returns the scripted network_error outcome", async () => {
    const gw = new StubPaymentGateway();
    gw.scriptVoid(err({ kind: "network_error", cause: "timeout" }));

    const result = await gw.voidPayment(makeVoidInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network_error");
    }
  });

  it("throws when called without a scripted outcome", async () => {
    const gw = new StubPaymentGateway();
    await expect(gw.voidPayment(makeVoidInput())).rejects.toThrow(
      /without a scripted outcome/,
    );
  });

  it("records every call with the exact input for inspection", async () => {
    const gw = new StubPaymentGateway();
    gw.scriptVoid(makeVoidOk());
    const input = makeVoidInput();

    await gw.voidPayment(input);

    expect(gw.voidCalls).toHaveLength(1);
    expect(gw.voidCalls[0]).toEqual(input);
  });
});

describe("StubPaymentGateway — queue independence", () => {
  it("scripting authorize does not affect voidPayment queue", async () => {
    const gw = new StubPaymentGateway();
    gw.scriptAuthorize(makeAuthOk());

    await expect(gw.voidPayment(makeVoidInput())).rejects.toThrow();

    // authorize queue survives the failed voidPayment call
    const result = await gw.authorize(makeAuthorizeInput());
    expect(result.ok).toBe(true);
  });
});
