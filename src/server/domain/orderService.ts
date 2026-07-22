/**
 * OrderService — the orchestrator.
 *
 * Every request to create or advance an order flows through here. Composes:
 *   - the pure state machine (`applyTransition`)
 *   - the payment gateway (`authorize`, `voidPayment`)
 *   - the repository (persist state + append history)
 *
 * Its two hard rules:
 *   1. NO state change happens without a passing `applyTransition` check.
 *   2. NO payment failure is silently swallowed — every `PaymentError` kind
 *      drives a specific recovery, and both the field-level `voidError` and
 *      the `history[].metadata` capture what happened.
 *
 * The four required failure recoveries land in `advance()`:
 *   - authorize declined                       → rejected
 *   - complete failed, void succeeded          → cancelled
 *   - complete failed, void failed             → needs_attention (+ voidError)
 *   - manual resolve on needs_attention        → cancelled
 */
import type {
  PaymentGateway,
  PaymentVoid,
} from "../payments/paymentGateway";
import type { OrderRepository } from "../repositories/orderRepository";
import {
  assertNever,
  err,
  type AdvanceEvent,
  type AmountCents,
  type Order,
  type OrderId,
  type OrderState,
  type PaymentError,
  type PaymentIntentId,
  type Result,
  type TransitionError,
} from "./types";
import { applyTransition } from "./orderState";

/**
 * Thrown when advance is called on an id that isn't in the repository.
 * Route handlers translate this into HTTP 404. Named class (not a generic
 * `Error`) so `error instanceof OrderNotFoundError` beats string-matching
 * on `.message`.
 */
export class OrderNotFoundError extends Error {
  constructor(public readonly orderId: OrderId) {
    super(`OrderService: order ${orderId} not found`);
    this.name = "OrderNotFoundError";
  }
}

/**
 * Thrown when the pure state machine refuses the requested transition.
 * Route handlers translate this into HTTP 409 (client sent an operation
 * that's inconsistent with the current state, e.g. authorizing an already
 * rejected order).
 */
export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: OrderState,
    public readonly to: OrderState,
    public readonly reason: TransitionError,
  ) {
    super(
      `OrderService: illegal transition ${from} → ${to} (${reason})`,
    );
    this.name = "IllegalTransitionError";
  }
}

/**
 * The shape callers pass to `advance`.
 *
 * `simulateCompletionFailure` and `simulateVoidFailure` are how we trigger
 * the completion-failure and void-failure paths from tests and the UI
 * without inventing a fake fulfillment system. They live on `AdvanceInput`
 * (NOT on `AdvanceEvent`) because they're how the event is processed, not
 * what the event is. The AdvanceEvent stays event-log-clean.
 */
export type AdvanceInput = {
  orderId: OrderId;
  event: AdvanceEvent;
  paymentMethodToken?: string;
  simulateCompletionFailure?: boolean;
  simulateVoidFailure?: boolean;
};

export class OrderService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  // ─── Reads ────────────────────────────────────────────────────────────────

  create(input: { amountCents: AmountCents }): Order {
    return this.repo.create(input);
  }

  get(id: OrderId): Order | null {
    return this.repo.get(id);
  }

  list(limit?: number): Order[] {
    return this.repo.list(limit);
  }

  // ─── The one write path ───────────────────────────────────────────────────

  async advance(input: AdvanceInput): Promise<Order> {
    const order = this.repo.get(input.orderId);
    if (!order) {
      throw new OrderNotFoundError(input.orderId);
    }

    switch (input.event.type) {
      case "authorize_payment":
        return this.authorize(order, input.paymentMethodToken ?? "pm_test");
      case "complete_order":
        return this.complete(order, {
          simulateCompletionFailure: input.simulateCompletionFailure ?? false,
          simulateVoidFailure: input.simulateVoidFailure ?? false,
        });
      case "resolve_manual":
        return this.resolveManual(order);
      default:
        return assertNever(input.event);
    }
  }

  // ─── Private handlers, one per event ──────────────────────────────────────

  private async authorize(
    order: Order,
    paymentMethodToken: string,
  ): Promise<Order> {
    const authResult = await this.gateway.authorize({
      orderId: order.id,
      amountCents: order.amountCents,
      paymentMethodToken,
    });

    if (!authResult.ok) {
      // Payment declined → reject. No cleanup needed.
      return this.commit(order, "rejected", "authorize_payment", {
        paymentError: authResult.error,
      });
    }

    // Success → move to payment_authorized and capture the intent id.
    return this.commit(
      order,
      "payment_authorized",
      "authorize_payment",
      {
        paymentIntentId: authResult.value.paymentIntentId,
        authorizedAt: authResult.value.authorizedAt,
      },
      { paymentIntentId: authResult.value.paymentIntentId },
    );
  }

  private async complete(
    order: Order,
    flags: {
      simulateCompletionFailure: boolean;
      simulateVoidFailure: boolean;
    },
  ): Promise<Order> {
    if (!flags.simulateCompletionFailure) {
      // Happy path — mark complete.
      return this.commit(order, "complete", "complete_order", {});
    }

    // Completion failed. We MUST attempt to void the authorized payment.
    if (!order.paymentIntentId) {
      throw new Error(
        `OrderService.complete: order ${order.id} has no paymentIntentId (state=${order.state})`,
      );
    }

    const completionError: PaymentError = {
      kind: "provider_error",
      message: "Simulated completion failure",
    };

    // `simulateVoidFailure` short-circuits the gateway call so we don't
    // spoil the gateway's own state. If the flag isn't set, we call the
    // real gateway (Demo or Stub depending on context).
    const voidResult: Result<PaymentVoid, PaymentError> =
      flags.simulateVoidFailure
        ? err<PaymentError>({
            kind: "network_error",
            cause: "Simulated void failure",
          })
        : await this.gateway.voidPayment({
            paymentIntentId: order.paymentIntentId,
          });

    if (voidResult.ok) {
      // Completion failed, void succeeded → cancelled cleanly.
      return this.commit(order, "cancelled", "complete_order", {
        completionError,
        voidedAt: voidResult.value.voidedAt,
      });
    }

    // Completion failed AND void failed → needs_attention. Loud + persistent.
    const voidErrorText = describeError(voidResult.error);
    return this.commit(
      order,
      "needs_attention",
      "complete_order",
      {
        completionError,
        voidError: voidResult.error,
      },
      { voidError: voidErrorText },
    );
  }

  private resolveManual(order: Order): Order {
    return this.commit(
      order,
      "cancelled",
      "resolve_manual",
      { note: "Manually resolved from needs_attention" },
      { voidError: null },
    );
  }

  // ─── The single write helper ──────────────────────────────────────────────

  /**
   * Every state change goes through here. `applyTransition` is called first,
   * so no repository write happens on an illegal transition. If callers hit
   * this with an illegal move, we throw — that's a programmer error (the
   * API layer should have rejected it earlier, or the state changed under
   * us). Never a Result.
   */
  private commit(
    order: Order,
    to: OrderState,
    eventType: AdvanceEvent["type"] | "created",
    metadata: Record<string, unknown>,
    extra: {
      paymentIntentId?: PaymentIntentId | null;
      voidError?: string | null;
    } = {},
  ): Order {
    const transition = applyTransition(order.state, to);
    if (!transition.ok) {
      throw new IllegalTransitionError(order.state, to, transition.error);
    }
    return this.repo.update(order.id, {
      state: to,
      historyEntry: {
        fromState: order.state,
        toState: to,
        eventType,
        occurredAt: new Date(),
        metadata,
      },
      paymentIntentId: extra.paymentIntentId,
      voidError: extra.voidError,
    });
  }
}

function describeError(error: PaymentError): string {
  switch (error.kind) {
    case "declined":
      return `declined: ${error.reason}`;
    case "network_error":
      return `network_error: ${String(error.cause)}`;
    case "provider_error":
      return `provider_error: ${error.message}`;
    default:
      return assertNever(error);
  }
}
