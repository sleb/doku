import { expect, test } from "@playwright/test";
import { open } from "./helpers";

const hint = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Hint, costs one heart" });

test("h places a face for a heart until the last heart", async ({ page }) => {
  await open(page, 400, 800, "demo-7");
  await expect(page.getByRole("img", { name: "3 of 3 hearts" })).toBeVisible();

  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "2 of 3 hearts" })).toBeVisible();
  await expect(page.getByRole("button", { name: /, face$/ })).toHaveCount(1);
  await expect(hint(page)).toBeEnabled();

  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "1 of 3 hearts" })).toBeVisible();
  await expect(hint(page)).toBeDisabled();

  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "1 of 3 hearts" })).toBeVisible();
  await expect(page.getByRole("button", { name: /, face$/ })).toHaveCount(2);
});
