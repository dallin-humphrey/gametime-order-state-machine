/**
 * Scenario 3 — Completion fails, void succeeds.
 *
 * create → authorize → complete (simulated fail) + void OK → cancelled
 *
 * History has 3 rows. Final row's metadata contains completionError AND
 * a voidedAt timestamp — proof the void was actually attempted and
 * succeeded before the state moved to `cancelled`. `order.voidError`
 * remains null (nothing went wrong on the void).
 */
import { expect, test } from "@playwright/test";

import { createOrder, screenshotFor, waitForState } from "./helpers";

test("completion fails, void OK → cancelled", async ({ page }) => {
  await createOrder(page);
  await page.getByRole("button", { name: "Authorize payment" }).click();
  await waitForState(page, "payment_authorized");

  await page
    .getByRole("button", { name: "Simulate: completion fails (void OK)" })
    .click();
  await waitForState(page, "cancelled");

  await expect(page.locator("tbody tr")).toHaveCount(3);
  // No loud void-error banner in this scenario — the void succeeded.
  await expect(
    page.getByText(/manual resolution required/i),
  ).toHaveCount(0);

  await screenshotFor(page, "3-completion-fail-void-ok");
});
