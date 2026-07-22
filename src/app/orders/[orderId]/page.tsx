/**
 * Order detail page.
 *
 * Server Component. Parses `orderId` through the branded Zod schema; a bad
 * shape or a missing order both trigger `notFound()`. Otherwise delegates
 * to <OrderDetailContent /> which is where all the display logic lives.
 */
import { notFound } from "next/navigation";

import { getOrderService } from "~/server/api/serviceInstance";
import { orderIdSchema } from "~/server/domain/types";

import { OrderDetailContent } from "./components/OrderDetailContent";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId: rawId } = await params;
  const parsed = orderIdSchema.safeParse(rawId);
  if (!parsed.success) notFound();

  const order = getOrderService().get(parsed.data);
  if (!order) notFound();

  return <OrderDetailContent order={order} />;
}
