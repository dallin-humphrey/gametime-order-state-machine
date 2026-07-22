/**
 * OrderDetailContent — the actual detail view.
 *
 * Server Component. Renders header (id + amount + state badge), a loud
 * banner if `voidError` is set (needs_attention), the advance controls
 * (client component), and the history table.
 *
 * `allowed = nextStates(order.state)` is computed here (on the server) and
 * passed down as a prop so the client component doesn't need to import
 * any state-machine code.
 */
import Link from "next/link";

import { nextStates } from "~/server/domain/orderState";
import type { Order } from "~/server/domain/types";

import { StateBadge } from "~/app/components/StateBadge";

import { AdvanceControls } from "./AdvanceControls";
import { StateHistoryTable } from "./StateHistoryTable";

export function OrderDetailContent({ order }: { order: Order }) {
  const allowed = nextStates(order.state);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/"
        className="text-xs text-neutral-500 hover:text-brand transition-colors"
      >
        ← All orders
      </Link>

      <div className="mt-6 flex items-start justify-between gap-6">
        <div>
          <p className="font-mono text-xs text-neutral-500">{order.id}</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-neutral-50">
            ${(order.amountCents / 100).toFixed(2)}
          </h1>
          <p className="mt-1 text-xs text-neutral-500">
            Created {new Date(order.createdAt).toLocaleString()} · Updated{" "}
            {new Date(order.updatedAt).toLocaleString()}
          </p>
        </div>
        <StateBadge state={order.state} />
      </div>

      {order.voidError && (
        <div className="mt-6 rounded-lg border-2 border-red-500/60 bg-red-500/10 p-4 text-sm text-red-100">
          <p className="font-semibold">Void error — manual resolution required</p>
          <p className="mt-1 font-mono text-xs text-red-200">
            {order.voidError}
          </p>
        </div>
      )}

      {order.paymentIntentId && (
        <p className="mt-4 text-xs text-neutral-500">
          Payment intent:{" "}
          <code className="text-neutral-300">{order.paymentIntentId}</code>
        </p>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Advance
        </h2>
        <AdvanceControls order={order} allowed={allowed} />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          History ({order.history.length})
        </h2>
        <StateHistoryTable history={order.history} />
      </section>
    </main>
  );
}
