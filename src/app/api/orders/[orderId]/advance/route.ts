/**
 * /api/orders/[orderId]/advance  —  the only mutation
 *
 *   POST { event, paymentMethodToken?, simulateCompletionFailure?, simulateVoidFailure? }
 *     → 200 Order (updated)
 *     → 400 invalid_input | invalid_order_id
 *     → 404 not_found
 *     → 409 illegal_transition (client's requested move isn't legal for current state)
 *     → 500 internal_error
 *
 * The event body is a Zod discriminated union — the client MUST send one of
 * the three known event types. `simulate*` flags are how the UI triggers
 * the failure paths without a real fulfillment system; see `orderServiceDoc.md`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getOrderService } from "~/server/api/serviceInstance";
import {
  IllegalTransitionError,
  OrderNotFoundError,
} from "~/server/domain/orderService";
import { orderIdSchema } from "~/server/domain/types";

const advanceInputSchema = z.object({
  event: z.discriminatedUnion("type", [
    z.object({ type: z.literal("authorize_payment") }),
    z.object({ type: z.literal("complete_order") }),
    z.object({ type: z.literal("resolve_manual") }),
  ]),
  paymentMethodToken: z.string().optional(),
  simulateCompletionFailure: z.boolean().optional(),
  simulateVoidFailure: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orderId: rawId } = await params;
  const idParse = orderIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json(
      { error: "invalid_order_id", issues: idParse.error.issues },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const inputParse = advanceInputSchema.safeParse(body);
  if (!inputParse.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: inputParse.error.issues },
      { status: 400 },
    );
  }

  try {
    const order = await getOrderService().advance({
      orderId: idParse.data,
      event: inputParse.data.event,
      paymentMethodToken: inputParse.data.paymentMethodToken,
      simulateCompletionFailure: inputParse.data.simulateCompletionFailure,
      simulateVoidFailure: inputParse.data.simulateVoidFailure,
    });
    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (error instanceof IllegalTransitionError) {
      return NextResponse.json(
        {
          error: "illegal_transition",
          from: error.from,
          to: error.to,
          reason: error.reason,
        },
        { status: 409 },
      );
    }
    // Unknown — programmer error. Log + surface with a generic message.
    console.error("[api/orders/advance] unexpected error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
