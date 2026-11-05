import { expect, test } from "@playwright/test";
import { open } from "./helpers";
import { levelBySize } from "./levels";

const hint = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Hint, costs one heart" });

test("h explains the next deduction for a heart until the last heart", async ({
  page,
}) => {
  await open(page, 400, 800, levelBySize(7).id);
  const banner = page.getByRole("status");
  await expect(page.getByRole("img", { name: "3 of 3 hearts" })).toBeVisible();
  await expect(banner).toHaveText("");

  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "2 of 3 hearts" })).toBeVisible();
  await expect(banner).toHaveText(/\S.*\.$/);
  await expect(page.locator("[data-hint]").first()).toBeVisible();
  await expect(hint(page)).toBeEnabled();

  // The same hint again is free; the board is unchanged for an elimination, and
  // a placement has already moved on to a new hint.
  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "1 of 3 hearts" })).toBeVisible();
  await expect(hint(page)).toBeDisabled();
  const shown = await banner.textContent();

  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "1 of 3 hearts" })).toBeVisible();
  await expect(banner).toHaveText(shown ?? "");
});

test("marking a cell clears the hint on display", async ({ page }) => {
  await open(page, 400, 800, levelBySize(7).id);
  await page.keyboard.press("h");
  await expect(page.getByRole("status")).toHaveText(/\S/);
  await page.getByRole("button", { name: /Row 1, column 1,/ }).click();
  await expect(page.getByRole("status")).toHaveText("");
  await expect(page.locator("[data-hint]")).toHaveCount(0);
});
