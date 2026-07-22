/**
 * /api/orders/[orderId]  —  get one
 *
 *   GET → 200 Order  |  400 invalid_order_id  |  404 not_found
 *
 * The `orderId` from the URL is parsed through the branded schema before it
 * ever reaches the service — a non-UUID string becomes 400, not a repo miss.
 */
import { NextResponse, type NextRequest } from "next/server";

import { getOrderService } from "~/server/api/serviceInstance";
import { orderIdSchema } from "~/server/domain/types";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orderId: rawId } = await params;
  const parsed = orderIdSchema.safeParse(rawId);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_order_id", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const order = getOrderService().get(parsed.data);
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(order);
}
