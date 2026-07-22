/**
 * The abstract PaymentGateway boundary.
 *
 * Every upstream caller (service, tests) programs against this shape so we
 * can swap `DemoPaymentGateway` (running app) for `StubPaymentGateway`
 * (tests) or a real Stripe/Adyen adapter later without touching the service.
 *
 * Both methods return `Result<T, PaymentError>` — declines are NEVER thrown.
 * Throwing would flatten "the card was declined" and "the provider crashed"
 * into the same catch block, and the whole assessment is about *not* doing
 * that. `Result` forces the caller to inspect `.ok` and branch.
 *
 * The method is named `voidPayment` (not `void`) because `void` is a TS
 * type keyword — using it as a method name works but reads as noise.
 */
import type {
  AmountCents,
  OrderId,
  PaymentError,
  PaymentIntentId,
  Result,
} from "../domain/types";

export type PaymentAuthorization = {
  paymentIntentId: PaymentIntentId;
  amountCents: AmountCents;
  authorizedAt: Date;
};

export type PaymentVoid = {
  paymentIntentId: PaymentIntentId;
  voidedAt: Date;
};

export type AuthorizeInput = {
  orderId: OrderId;
  amountCents: AmountCents;
  paymentMethodToken: string;
};

export type VoidInput = {
  paymentIntentId: PaymentIntentId;
};

export type PaymentGateway = {
  authorize(
    input: AuthorizeInput,
  ): Promise<Result<PaymentAuthorization, PaymentError>>;
  voidPayment(
    input: VoidInput,
  ): Promise<Result<PaymentVoid, PaymentError>>;
};
