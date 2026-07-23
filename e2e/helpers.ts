/**
 * Small helpers shared across e2e specs.
 *
 * - `createOrder(page)` — visits `/`, clicks "New Order", waits for the
 *   detail page, returns the order id from the URL.
 * - `waitForState(page, state)` — waits until the state badge shows the
 *   given data-state attribute. Uses Playwright's built-in retry logic.
 * - `screenshotFor(page, name)` — full-page screenshot into
 *   `test-results/scenario-<name>.png`. Attached to the HTML report
 *   because it lives under test-results/.
 */
import { expect, type Page } from "@playwright/test";

/**
 * Local mirror of `OrderState` from `src/server/domain/types.ts`.
 * Duplicated (rather than imported via `~/…`) because Playwright's test
 * runner has its own TS resolver that doesn't respect the app's path
 * aliases. Duplication is fine here: this list only changes when the
 * domain adds a state, and both files would need updating either way.
 */
type OrderState =
  | "initialized"
  | "payment_authorized"
  | "complete"
  | "rejected"
  | "cancelled"
  | "needs_attention";

export async function createOrder(page: Page): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: /new order/i }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+/);
  const url = new URL(page.url());
  const parts = url.pathname.split("/");
  const id = parts.at(-1);
  if (!id) throw new Error(`unexpected URL: ${page.url()}`);
  return id;
}

export async function waitForState(page: Page, state: OrderState): Promise<void> {
  const badge = page.locator(`[data-state="${state}"]`).first();
  await expect(badge).toBeVisible({ timeout: 10_000 });
}

export async function screenshotFor(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `test-results/scenario-${name}.png`,
    fullPage: true,
  });
}
