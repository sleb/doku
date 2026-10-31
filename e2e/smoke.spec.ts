import { expect, test } from "@playwright/test";

test("the app loads and mounts into #root", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/\S/);
  await expect(page.locator("#root")).not.toBeEmpty();
});
