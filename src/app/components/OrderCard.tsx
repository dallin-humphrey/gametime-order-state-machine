/**
 * OrderCard — one row in the orders list.
 *
 * Renders the amount, a short id prefix, and the current StateBadge.
 * Pure presentation — no state, no fetches, no client marker.
 */
import type { Order } from "~/server/domain/types";

import { StateBadge } from "./StateBadge";

export function OrderCard({ order }: { order: Order }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-5 py-4 transition-colors hover:border-brand/40 hover:bg-surface-hi">
      <div>
        <p className="font-mono text-xs text-neutral-500">
          {order.id.slice(0, 8)}…
        </p>
        <p className="mt-1 text-lg font-semibold text-neutral-100">
          {formatCents(order.amountCents)}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {order.history.length}{" "}
          {order.history.length === 1 ? "event" : "events"} ·{" "}
          {new Date(order.updatedAt).toLocaleTimeString()}
        </p>
      </div>
      <StateBadge state={order.state} />
    </div>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
