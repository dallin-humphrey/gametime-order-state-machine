/**
 * DemoPaymentGateway — the gateway used by the running app.
 *
 * Deterministic behavior based on inputs — no external calls, no real card
 * processing. This is what the assessment means by "stub payment as an
 * interface" for the runtime side.
 *
 * Behavior:
 *   - authorize({ paymentMethodToken: "decline" }) → declines with a
 *     `PaymentError` of kind `declined`.
 *   - authorize({ paymentMethodToken: any other value }) → succeeds with
 *     a fresh `PaymentIntentId` and the input amount.
 *   - voidPayment(_) → always succeeds.
 *
 * The `voidPayment` failure branch is triggered at the SERVICE layer via
 * an explicit `simulateVoidFailure` flag on the advance request, not by
 * this gateway. Reason: the assessment says "stub payment as an interface,"
 * and injecting per-request outcomes here would blur that boundary — the
 * gateway should look like a real gateway that just happens to always
 * void successfully.
 */
import { randomUUID } from "node:crypto";

import type { PaymentError, Result } from "../domain/types";
import { err, ok, paymentIntentIdSchema } from "../domain/types";
import type {
  AuthorizeInput,
  PaymentAuthorization,
  PaymentGateway,
  PaymentVoid,
  VoidInput,
} from "./paymentGateway";

export class DemoPaymentGateway implements PaymentGateway {
  async authorize(
    input: AuthorizeInput,
  ): Promise<Result<PaymentAuthorization, PaymentError>> {
    if (input.paymentMethodToken === "decline") {
      return err({
        kind: "declined",
        reason: "Card declined by issuer (demo)",
      } satisfies PaymentError);
    }
    return ok({
      paymentIntentId: paymentIntentIdSchema.parse(`pi_${randomUUID()}`),
      amountCents: input.amountCents,
      authorizedAt: new Date(),
    });
  }

  async voidPayment(
    input: VoidInput,
  ): Promise<Result<PaymentVoid, PaymentError>> {
    return ok({
      paymentIntentId: input.paymentIntentId,
      voidedAt: new Date(),
    });
  }
}
