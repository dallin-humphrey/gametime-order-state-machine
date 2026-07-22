/**
 * NewOrderButton — client-side "create + navigate to detail" action.
 *
 * The one client component on the list page. POSTs to /api/orders and
 * routes to /orders/[id] on success. `router.refresh()` after navigation
 * so the RSC detail page sees the new order.
 *
 * Amount input defaults to $25.00 (2500¢). The number input is intentionally
 * in *cents* so the wire format matches the branded `AmountCents` type
 * (integer, no rounding). A "friendly dollar input" would be a nice-to-have
 * but adds unit-conversion bugs.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewOrderButton() {
  const router = useRouter();
  const [amountCents, setAmountCents] = useState(2500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      if (!res.ok) {
        setError(`Create failed: ${res.status}`);
        return;
      }
      const order = (await res.json()) as { id: string };
      router.push(`/orders/${order.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-neutral-500">
          Amount
          <input
            type="number"
            min={0}
            step={1}
            value={amountCents}
            onChange={(e) =>
              setAmountCents(Math.max(0, Math.floor(Number(e.target.value))))
            }
            className="w-24 rounded border border-line bg-surface px-2 py-1 text-sm text-neutral-100 focus:border-brand focus:outline-none"
          />
          <span className="text-neutral-600">¢</span>
        </label>
        <button
          onClick={handleCreate}
          disabled={isSubmitting}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          {isSubmitting ? "Creating…" : "New Order"}
        </button>
      </div>
      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
