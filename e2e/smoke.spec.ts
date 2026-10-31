import { expect, test } from "@playwright/test";

test("the app loads and mounts into #root", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/\S/);
  await expect(page.locator("#root")).not.toBeEmpty();
});

test("the region color tokens are applied", async ({ page }) => {
  await page.goto("/");
  const token = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.color = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-region-3")
      .trim();
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  const swatch = page.locator(".bg-region-3");
  await expect(swatch).toHaveCSS("background-color", token);
});
