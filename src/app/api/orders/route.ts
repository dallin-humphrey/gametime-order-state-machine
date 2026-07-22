/**
 * /api/orders  —  list + create
 *
 *   GET  ?limit=50  → { orders: Order[] }
 *   POST { amountCents }  → 201 Order
 *
 * Zod is the source of truth for input validation. Branded types
 * (AmountCents) are produced by parsing through the branded schemas so the
 * downstream service can trust its inputs at the type AND runtime level.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getOrderService } from "~/server/api/serviceInstance";
import { amountCentsSchema } from "~/server/domain/types";

const createInputSchema = z.object({
  amountCents: z.number().int().nonnegative(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Math.max(1, Math.min(100, Number(rawLimit))) : 50;

  const orders = getOrderService().list(limit);
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const order = getOrderService().create({
    amountCents: amountCentsSchema.parse(parsed.data.amountCents),
  });
  return NextResponse.json(order, { status: 201 });
}
