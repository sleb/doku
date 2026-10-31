import { expect, test } from "@playwright/test";

test("the app loads and mounts into #root", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/\S/);
  await expect(page.locator("#root")).not.toBeEmpty();
});

test("the region color tokens are applied", async ({ page }) => {
  await page.goto("/");
  const cell = page.getByRole("button", { name: /^Row 1, column 1,/ });
  const cls = (await cell.getAttribute("class")) ?? "";
  const region = /bg-region-(\d+)/.exec(cls)?.[1];
  expect(region).toBeDefined();
  const token = await page.evaluate((r) => {
    const probe = document.createElement("div");
    probe.style.color = getComputedStyle(document.documentElement)
      .getPropertyValue(`--color-region-${r}`)
      .trim();
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, region);
  await expect(cell).toHaveCSS("background-color", token);
});
