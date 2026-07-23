/**
 * Scenario 2 — Payment decline.
 *
 * create → authorize (simulate: decline) → rejected
 *
 * No cleanup needed. History has 2 rows; the second row's metadata
 * contains the decline reason ("Card declined by issuer (demo)").
 */
import { expect, test } from "@playwright/test";

import { createOrder, screenshotFor, waitForState } from "./helpers";

test("payment decline: authorize (declined) → rejected", async ({ page }) => {
  await createOrder(page);
  await waitForState(page, "initialized");

  await page
    .getByRole("button", { name: "Authorize (simulate: decline)" })
    .click();
  await waitForState(page, "rejected");

  await expect(page.locator("tbody tr")).toHaveCount(2);
  // Decline reason should appear in the metadata JSON of the last row.
  await expect(page.getByText(/Card declined by issuer/i).first()).toBeVisible();

  await screenshotFor(page, "2-payment-decline");
});
