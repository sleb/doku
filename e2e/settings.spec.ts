import { expect, test } from "@playwright/test";

const fresh = { cookies: [], origins: [] };
const rules = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "Rules" });

test.describe("fresh install", () => {
  test.use({ storageState: fresh });

  test("Rules show once, then never again after Got it", async ({ page }) => {
    await page.goto("/");
    await expect(rules(page)).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(rules(page)).toBeHidden();
    await page.reload();
    // The saved game comes back paused (M4-08).
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(
      page.getByRole("grid", { name: "Puzzle board" }),
    ).toBeVisible();
    await expect(rules(page)).toBeHidden();
  });

  test("corrupt stored settings boot with Rules shown", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("doku:settings", '"garbage"'),
    );
    await page.goto("/");
    await expect(rules(page)).toBeVisible();
  });
});

test("haptics off in Settings persists across reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  const sw = page.getByRole("switch", { name: "Haptics" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await page.reload();
  // The saved game comes back paused, so the Pause dialog is already open.
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("switch", { name: "Haptics" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});
