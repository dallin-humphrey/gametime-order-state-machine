/**
 * OrderRepository — the persistence boundary.
 *
 * The interface separates *what* the store does from *how*. The
 * OrderService programs against `OrderRepository`, so a future Drizzle /
 * Postgres implementation could slot in with zero upstream changes.
 *
 * The one shipped implementation, `InMemoryOrderRepository`, wraps a
 * `Map<OrderId, Order>` attached to `globalThis` so state survives Next.js
 * HMR (dev) and warm serverless instances (Vercel prod). Cold starts still
 * lose state — that's called out in the README under Known Limitations.
 */
import { randomUUID } from "node:crypto";

import {
  orderIdSchema,
  type AmountCents,
  type Order,
  type OrderHistoryEntry,
  type OrderId,
  type OrderState,
  type PaymentIntentId,
} from "../domain/types";

export type OrderUpdate = {
  state: OrderState;
  historyEntry: OrderHistoryEntry;
  /**
   * Explicit `undefined` = "don't touch". Explicit `null` = "clear it."
   * Distinguishing lets the service null-out `voidError` on manual resolve
   * without also nulling the paymentIntentId.
   */
  paymentIntentId?: PaymentIntentId | null;
  voidError?: string | null;
};

export type OrderRepository = {
  create(input: { amountCents: AmountCents }): Order;
  get(id: OrderId): Order | null;
  list(limit?: number): Order[];
  update(id: OrderId, changes: OrderUpdate): Order;
};

// -----------------------------------------------------------------------------
// InMemoryOrderRepository — the shipped implementation.
// -----------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __orderStore: Map<OrderId, Order> | undefined;
}

function getGlobalStore(): Map<OrderId, Order> {
  if (!globalThis.__orderStore) {
    globalThis.__orderStore = new Map<OrderId, Order>();
  }
  return globalThis.__orderStore;
}

export class InMemoryOrderRepository implements OrderRepository {
  /**
   * By default we attach to the globalThis-scoped map. Tests may pass their
   * own fresh Map to guarantee isolation without touching global state.
   */
  private readonly store: Map<OrderId, Order>;

  constructor(store?: Map<OrderId, Order>) {
    this.store = store ?? getGlobalStore();
  }

  create(input: { amountCents: AmountCents }): Order {
    const id = orderIdSchema.parse(randomUUID());
    const now = new Date();
    const creationEntry: OrderHistoryEntry = {
      fromState: null,
      toState: "initialized",
      eventType: "created",
      occurredAt: now,
      metadata: { amountCents: input.amountCents },
    };
    const order: Order = {
      id,
      state: "initialized",
      amountCents: input.amountCents,
      paymentIntentId: null,
      voidError: null,
      createdAt: now,
      updatedAt: now,
      history: [creationEntry],
    };
    this.store.set(id, order);
    return order;
  }

  get(id: OrderId): Order | null {
    return this.store.get(id) ?? null;
  }

  list(limit = 50): Order[] {
    // Map iteration is guaranteed insertion order by ECMAScript, so reversing
    // the array is a monotonic "most recent first" sort. Sorting by
    // createdAt is a race — two orders created in the same millisecond tie
    // and stable sort would preserve insertion order (i.e. oldest first).
    return Array.from(this.store.values()).reverse().slice(0, limit);
  }

  update(id: OrderId, changes: OrderUpdate): Order {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`OrderRepository.update: order ${id} not found`);
    }
    const updated: Order = {
      ...existing,
      state: changes.state,
      paymentIntentId:
        changes.paymentIntentId === undefined
          ? existing.paymentIntentId
          : changes.paymentIntentId,
      voidError:
        changes.voidError === undefined
          ? existing.voidError
          : changes.voidError,
      updatedAt: new Date(),
      history: [...existing.history, changes.historyEntry],
    };
    this.store.set(id, updated);
    return updated;
  }

  /** Test-only helper — resets the shared store. */
  clear(): void {
    this.store.clear();
  }
}
