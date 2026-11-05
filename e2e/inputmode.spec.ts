import { expect, test } from "@playwright/test";
import { cell } from "./helpers";
import { levelBySize } from "./levels";

const { size, solution } = levelBySize(7);
const toggle = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Tap places faces" });

test("by default a click only marks", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, solution[0]);
  await target.click();
  await expect(target).toHaveAccessibleName(/, marked$/);
});

test("with Tap places faces on, clicks alone win the level", async ({
  page,
}) => {
  await page.goto("/");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  for (let r = 0; r < size; r++) await cell(page, r, solution[r]).click();
  await expect(
    page.getByRole("heading", { name: "You solved it" }),
  ).toBeVisible();
});

test("the f key toggles the mode", async ({ page }) => {
  await page.goto("/");
  await expect(toggle(page)).toBeEnabled();
  await page.keyboard.press("f");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("f");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
});
