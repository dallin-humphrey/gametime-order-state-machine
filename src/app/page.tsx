/**
 * Orders list page.
 *
 * Server Component — reads directly from the in-process `OrderService`
 * singleton. `dynamic = "force-dynamic"` disables prerendering because the
 * order list mutates on every request.
 *
 * The "New Order" input + button is a client component (NewOrderButton) —
 * everything else is server-rendered.
 */
import Link from "next/link";

import { getOrderService } from "~/server/api/serviceInstance";

import { NewOrderButton } from "./components/NewOrderButton";
import { OrderCard } from "./components/OrderCard";

export const dynamic = "force-dynamic";

export default async function OrdersListPage() {
  const orders = getOrderService().list();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <span className="inline-block rounded-full border border-line px-3 py-1 text-xs uppercase tracking-widest text-brand">
            Gametime · Take-Home
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-neutral-50">
            Orders
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {orders.length === 0
              ? "No orders yet. Create one to walk it through the state machine."
              : `${orders.length} order${orders.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <NewOrderButton />
      </header>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-10 text-center text-neutral-500">
          <p>The store is empty.</p>
          <p className="mt-1 text-xs">
            State lives in memory — it resets on server restart or serverless
            cold start.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="block focus:outline-none focus:ring-2 focus:ring-brand rounded-lg"
              >
                <OrderCard order={order} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
