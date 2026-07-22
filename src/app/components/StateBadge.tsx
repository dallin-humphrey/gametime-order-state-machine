/**
 * StateBadge — the visual language for order states.
 *
 * One badge component maps every `OrderState` to a color + label. Used on
 * the list page, the detail page header, and the history table.
 *
 * `Record<OrderState, string>` for the styles + labels lookup is enforced
 * by the `OrderState` union — adding a new state to `types.ts` becomes a
 * compile error here until the new key is added. That's the whole reason
 * we didn't just inline the switch: guaranteed exhaustiveness.
 *
 * Only `needs_attention` is deliberately loud (pulsing red border). The
 * assessment's "don't silently swallow" requirement warrants an
 * attention-grabbing visual for that state specifically.
 */
import type { OrderState } from "~/server/domain/types";

const styles: Record<OrderState, string> = {
  initialized:
    "bg-neutral-800 text-neutral-300 border border-neutral-700",
  payment_authorized:
    "bg-blue-500/15 text-blue-200 border border-blue-400/30",
  complete: "bg-brand/20 text-brand border border-brand/40",
  rejected:
    "bg-red-500/15 text-red-300 border border-red-500/40",
  cancelled:
    "bg-amber-500/15 text-amber-200 border border-amber-500/40",
  needs_attention:
    "bg-red-500/20 text-red-100 border-2 border-red-400 animate-pulse",
};

const labels: Record<OrderState, string> = {
  initialized: "Initialized",
  payment_authorized: "Payment Authorized",
  complete: "Complete",
  rejected: "Rejected",
  cancelled: "Cancelled",
  needs_attention: "Needs Attention",
};

export function StateBadge({ state }: { state: OrderState }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${styles[state]}`}
    >
      {labels[state]}
    </span>
  );
}
