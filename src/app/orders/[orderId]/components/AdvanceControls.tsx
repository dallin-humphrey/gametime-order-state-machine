/**
 * AdvanceControls — client component with one button per legal transition.
 *
 * Reads `order.state` and renders a labeled button for each legal advance
 * option. Each button POSTs to /api/orders/[id]/advance with the exact
 * body shape the route handler expects.
 *
 * The simulation flags (`simulateCompletionFailure`, `simulateVoidFailure`)
 * are surfaced as clearly-labeled buttons — that's how the interviewer
 * triggers the "completion fails, void OK" and "both fail" paths from the
 * UI without a real fulfillment system. Called out in the button labels.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AdvanceEvent, Order, OrderState } from "~/server/domain/types";

type Tone = "primary" | "warn" | "danger";

type ControlOption = {
  label: string;
  event: AdvanceEvent;
  paymentMethodToken?: string;
  simulateCompletionFailure?: boolean;
  simulateVoidFailure?: boolean;
  tone: Tone;
};

function optionsFor(state: OrderState): ControlOption[] {
  switch (state) {
    case "initialized":
      return [
        {
          label: "Authorize payment",
          event: { type: "authorize_payment" },
          paymentMethodToken: "pm_test",
          tone: "primary",
        },
        {
          label: "Authorize (simulate: decline)",
          event: { type: "authorize_payment" },
          paymentMethodToken: "decline",
          tone: "warn",
        },
      ];
    case "payment_authorized":
      return [
        {
          label: "Complete order",
          event: { type: "complete_order" },
          tone: "primary",
        },
        {
          label: "Simulate: completion fails (void OK)",
          event: { type: "complete_order" },
          simulateCompletionFailure: true,
          tone: "warn",
        },
        {
          label: "Simulate: completion + void fail",
          event: { type: "complete_order" },
          simulateCompletionFailure: true,
          simulateVoidFailure: true,
          tone: "danger",
        },
      ];
    case "needs_attention":
      return [
        {
          label: "Manually resolve → cancelled",
          event: { type: "resolve_manual" },
          tone: "primary",
        },
      ];
    case "complete":
    case "rejected":
    case "cancelled":
      return [];
  }
}

const toneClasses: Record<Tone, string> = {
  primary:
    "bg-brand text-ink hover:bg-brand-light shadow-lg shadow-brand/20",
  warn:
    "bg-amber-500/20 text-amber-100 border border-amber-500/40 hover:bg-amber-500/30",
  danger:
    "bg-red-500/20 text-red-100 border border-red-500/40 hover:bg-red-500/30",
};

export function AdvanceControls({
  order,
  allowed,
}: {
  order: Order;
  allowed: readonly OrderState[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = optionsFor(order.state);

  async function submit(option: ControlOption) {
    setBusy(option.label);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/advance`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: option.event,
          paymentMethodToken: option.paymentMethodToken,
          simulateCompletionFailure: option.simulateCompletionFailure,
          simulateVoidFailure: option.simulateVoidFailure,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setError(`${res.status}: ${body || res.statusText}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setBusy(null);
    }
  }

  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface px-5 py-4 text-sm">
        <p className="text-neutral-400">
          No further transitions from{" "}
          <code className="text-neutral-200">{order.state}</code>. This is a
          terminal state.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => submit(opt)}
            disabled={busy !== null}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${toneClasses[opt.tone]}`}
          >
            {busy === opt.label ? "…" : opt.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}
      <p className="mt-4 text-xs text-neutral-500">
        Allowed next states from{" "}
        <code className="text-neutral-300">{order.state}</code>:{" "}
        {allowed.length > 0 ? (
          allowed.map((s) => (
            <code
              key={s}
              className="mx-1 rounded bg-surface px-1.5 py-0.5 text-neutral-300"
            >
              {s}
            </code>
          ))
        ) : (
          <span className="text-neutral-600">none (terminal)</span>
        )}
      </p>
    </div>
  );
}
