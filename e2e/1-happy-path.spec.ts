/**
 * Scenario 1 — Happy path.
 *
 * create → authorize → complete
 *
 * Terminal state: `complete`. History has 3 rows.
 */
import { expect, test } from "@playwright/test";

import { createOrder, screenshotFor, waitForState } from "./helpers";

test("happy path: create → authorize → complete", async ({ page }) => {
  await createOrder(page);
  await waitForState(page, "initialized");

  await page.getByRole("button", { name: "Authorize payment" }).click();
  await waitForState(page, "payment_authorized");

  await page.getByRole("button", { name: "Complete order" }).click();
  await waitForState(page, "complete");

  // History should have 3 rows: created, payment_authorized, complete.
  await expect(page.locator("tbody tr")).toHaveCount(3);

  await screenshotFor(page, "1-happy-path");
});
