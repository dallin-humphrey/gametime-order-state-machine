/**
 * Scenario 5 — Manual resolve of a needs_attention order.
 *
 * needs_attention → cancelled (via "Manually resolve → cancelled")
 *
 * Clears `voidError`; the loud red banner disappears from the UI.
 * The history keeps both prior entries — resolving doesn't erase the
 * audit trail, it just adds a new row.
 */
import { expect, test } from "@playwright/test";

import { createOrder, screenshotFor, waitForState } from "./helpers";

test("needs_attention → manually resolved → cancelled (banner gone)", async ({
  page,
}) => {
  await createOrder(page);
  await page.getByRole("button", { name: "Authorize payment" }).click();
  await waitForState(page, "payment_authorized");

  await page
    .getByRole("button", { name: "Simulate: completion + void fail" })
    .click();
  await waitForState(page, "needs_attention");

  await page
    .getByRole("button", { name: "Manually resolve → cancelled" })
    .click();
  await waitForState(page, "cancelled");

  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(
    page.getByText(/manual resolution required/i),
  ).toHaveCount(0);

  await screenshotFor(page, "5-manual-resolve");
});
