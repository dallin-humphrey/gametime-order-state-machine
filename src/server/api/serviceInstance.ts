/**
 * Module-level singleton `OrderService` used by every route handler.
 *
 * Attached to `globalThis` so it survives Next.js HMR (dev) and stays as one
 * instance per warm serverless instance (prod). All state ultimately lives
 * inside the InMemoryOrderRepository's `globalThis.__orderStore` map, so the
 * singleton is really just an ergonomic wrapper — instantiating a fresh
 * OrderService against the same map is functionally equivalent.
 *
 * Kept in a separate file (not inlined in a route handler) so tests / RSC
 * server components can also grab the same instance.
 */
import { OrderService } from "../domain/orderService";
import { DemoPaymentGateway } from "../payments/demoPaymentGateway";
import { InMemoryOrderRepository } from "../repositories/orderRepository";

declare global {
  // eslint-disable-next-line no-var
  var __orderService: OrderService | undefined;
}

export function getOrderService(): OrderService {
  if (!globalThis.__orderService) {
    globalThis.__orderService = new OrderService(
      new InMemoryOrderRepository(),
      new DemoPaymentGateway(),
    );
  }
  return globalThis.__orderService;
}
