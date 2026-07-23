/**
 * Scenario 4 — Completion AND void both fail.
 *
 * create → authorize → complete + void both simulated to fail → needs_attention
 *
 * The critical assertion: `order.voidError` is set AND the loud red banner
 * "manual resolution required" is visible. That's the whole "don't silently
 * swallow" requirement made visible.
 */
import { expect, test } from "@playwright/test";

import { createOrder, screenshotFor, waitForState } from "./helpers";

test("completion + void both fail → needs_attention with voidError banner", async ({
  page,
}) => {
  await createOrder(page);
  await page.getByRole("button", { name: "Authorize payment" }).click();
  await waitForState(page, "payment_authorized");

  await page
    .getByRole("button", { name: "Simulate: completion + void fail" })
    .click();
  await waitForState(page, "needs_attention");

  await expect(page.locator("tbody tr")).toHaveCount(3);
  // The loud red banner MUST be visible — this is the assessment's
  // "don't silently swallow" requirement made concrete.
  await expect(
    page.getByText(/manual resolution required/i),
  ).toBeVisible();
  await expect(page.getByText(/network_error/i).first()).toBeVisible();

  await screenshotFor(page, "4-completion-fail-void-fail");
});
