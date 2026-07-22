/**
 * StubPaymentGateway — a test double for `PaymentGateway`.
 *
 * Tests script the next expected outcome (success or failure) and the stub
 * returns outcomes in FIFO order. If a call is made without a scripted
 * outcome, the stub THROWS — that's a test-authoring bug (missing setup),
 * NOT a domain event, so an exception is the correct signal.
 *
 * Every call is recorded on `authorizeCalls` / `voidCalls` for assertion.
 *
 * Usage:
 *   const gw = new StubPaymentGateway();
 *   gw.scriptAuthorize(ok({ paymentIntentId, amountCents, authorizedAt }));
 *   gw.scriptVoid(err({ kind: "network_error", cause: new Error("timeout") }));
 */
import type { PaymentError, Result } from "../domain/types";
import type {
  AuthorizeInput,
  PaymentAuthorization,
  PaymentGateway,
  PaymentVoid,
  VoidInput,
} from "./paymentGateway";

export class StubPaymentGateway implements PaymentGateway {
  private readonly authorizeQueue: Array<
    Result<PaymentAuthorization, PaymentError>
  > = [];
  private readonly voidQueue: Array<Result<PaymentVoid, PaymentError>> = [];

  /** Every authorize() call, in order — useful for assertions. */
  readonly authorizeCalls: AuthorizeInput[] = [];
  /** Every voidPayment() call, in order — useful for assertions. */
  readonly voidCalls: VoidInput[] = [];

  scriptAuthorize(
    ...outcomes: Array<Result<PaymentAuthorization, PaymentError>>
  ): void {
    this.authorizeQueue.push(...outcomes);
  }

  scriptVoid(
    ...outcomes: Array<Result<PaymentVoid, PaymentError>>
  ): void {
    this.voidQueue.push(...outcomes);
  }

  async authorize(
    input: AuthorizeInput,
  ): Promise<Result<PaymentAuthorization, PaymentError>> {
    this.authorizeCalls.push(input);
    const next = this.authorizeQueue.shift();
    if (!next) {
      throw new Error(
        "StubPaymentGateway.authorize called without a scripted outcome. " +
          "Call scriptAuthorize(...) in your test setup.",
      );
    }
    return next;
  }

  async voidPayment(
    input: VoidInput,
  ): Promise<Result<PaymentVoid, PaymentError>> {
    this.voidCalls.push(input);
    const next = this.voidQueue.shift();
    if (!next) {
      throw new Error(
        "StubPaymentGateway.voidPayment called without a scripted outcome. " +
          "Call scriptVoid(...) in your test setup.",
      );
    }
    return next;
  }
}
