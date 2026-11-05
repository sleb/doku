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

test("sound off in Settings persists across reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  const sw = page.getByRole("switch", { name: "Sound" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await page.reload();
  // The saved game comes back paused, so the Pause dialog is already open.
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("switch", { name: "Sound" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
});

for (const [w, h] of [
  [667, 375],
  [667, 300],
] as const) {
  test(`Settings stays inside a ${w}x${h} viewport and scrolls`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await page.getByRole("button", { name: "Pause" }).click();
    await page.getByRole("button", { name: "Settings" }).click();
    const body = page.getByTestId("dialog-body");
    await expect(body).toBeVisible();
    const panel = page.getByRole("dialog", { name: "Settings" });
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(h);
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
      true,
    );
    const done = page.getByRole("button", { name: "Done" });
    await done.scrollIntoViewIfNeeded();
    await expect(done).toBeInViewport();
    const startOver = page.getByRole("button", { name: "Start over" });
    await startOver.scrollIntoViewIfNeeded();
    await startOver.click();
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
  });
}

test("Rules stays inside its panel at 667x300", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 300 });
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Rules" }).click();
  const panel = page.getByRole("dialog", { name: "Rules" });
  await expect(panel).toBeVisible();
  const p = await panel.boundingBox();
  expect(p).not.toBeNull();
  expect(p!.y).toBeGreaterThanOrEqual(0);
  expect(p!.y + p!.height).toBeLessThanOrEqual(300);
  const body = page.getByTestId("dialog-body");
  const b = await body.boundingBox();
  expect(b!.y + b!.height).toBeLessThanOrEqual(p!.y + p!.height);
  expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
});
