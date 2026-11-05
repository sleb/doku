import { expect, test } from "@playwright/test";
import { open } from "./helpers";
import { levelBySize } from "./levels";

const paused = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Paused" });

test("the clock advances and Pause then Resume works", async ({ page }) => {
  await open(page, 400, 800, levelBySize(7).id);
  await expect(page.getByText("0:00")).toBeVisible();
  await expect(page.getByText("0:01")).toBeVisible({ timeout: 3000 });

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(paused(page)).toBeVisible();
  await expect(page.getByRole("grid")).toBeHidden();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(paused(page)).toBeHidden();
  await expect(page.getByRole("grid", { name: "Puzzle board" })).toBeVisible();
});

test("the clock stops while paused", async ({ page }) => {
  await open(page, 400, 800, levelBySize(7).id);
  await page.getByRole("button", { name: "Pause" }).click();
  const time = await page.locator("time").textContent();
  await page.waitForTimeout(1500);
  await expect(page.locator("time")).toHaveText(time ?? "");
});

test("a hidden document auto-pauses", async ({ page }) => {
  await open(page, 400, 800, levelBySize(7).id);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(paused(page)).toBeVisible();
});
