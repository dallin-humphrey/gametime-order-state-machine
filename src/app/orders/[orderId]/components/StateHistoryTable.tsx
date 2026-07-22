/**
 * StateHistoryTable — every transition, in order, with metadata.
 *
 * Server component. Renders `order.history` as a table with columns:
 * timestamp, event, from state, to state, metadata (as pretty JSON).
 *
 * The pretty-printed JSON in the metadata cell is deliberate — the
 * assessment's failure paths capture `paymentError` and `voidError`
 * objects in metadata, and showing them verbatim is the honest audit
 * trail. Prettifying them would obscure the shape.
 */
import type { OrderHistoryEntry } from "~/server/domain/types";

import { StateBadge } from "~/app/components/StateBadge";

export function StateHistoryTable({
  history,
}: {
  history: readonly OrderHistoryEntry[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-xs uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Event</th>
            <th className="px-4 py-3 font-medium">From → To</th>
            <th className="px-4 py-3 font-medium">Metadata</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {history.map((entry, i) => (
            <tr key={i} className="bg-surface/40 align-top">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                {new Date(entry.occurredAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-300">
                {entry.eventType}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {entry.fromState ? (
                    <StateBadge state={entry.fromState} />
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                  <span className="text-neutral-600">→</span>
                  <StateBadge state={entry.toState} />
                </div>
              </td>
              <td className="px-4 py-3">
                {Object.keys(entry.metadata).length > 0 ? (
                  <pre className="max-w-xs overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-neutral-400">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                ) : (
                  <span className="text-neutral-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
