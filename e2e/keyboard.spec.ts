import { expect, test } from "@playwright/test";
import { cell, hearts, open, press } from "./helpers";
import { levelBySize } from "./levels";

const { solution } = levelBySize(7);

test("a level can be played from the keyboard alone", async ({ page }) => {
  await open(page, 800, 900, levelBySize(7).id);

  // The board is one Tab stop, on the active cell.
  await expect(page.locator("button[data-index][tabindex='0']")).toHaveCount(1);
  await page.keyboard.press("Tab"); // the top bar's Pause button
  await page.keyboard.press("Tab");
  await expect(cell(page, 0, 0)).toBeFocused();

  // The focus ring is drawn.
  const outline = await cell(page, 0, 0).evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: s.outlineWidth };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).not.toBe("0px");

  // Arrows move, x marks, z undoes.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect(cell(page, 1, 1)).toBeFocused();
  await expect(page.locator("button[data-index][tabindex='0']")).toHaveCount(1);
  await page.keyboard.press("x");
  await expect(cell(page, 1, 1)).toHaveAccessibleName(/, marked$/);
  await page.keyboard.press("z");
  await expect(cell(page, 1, 1)).toHaveAccessibleName(/, empty$/);

  // Holding Space places a face; the locked cell keeps focus and arrows pass over it.
  const target = cell(page, 0, solution[0]);
  await press(page, target);
  await expect(target).toHaveAccessibleName(/, face$/);
  await expect(target).toBeFocused();
  await expect(target).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(target).toBeFocused();

  // h spends a heart on a hint.
  await page.keyboard.press("h");
  await expect(hearts(page, 2)).toBeVisible();
  await expect(page.getByRole("button", { name: /, face$/ })).toHaveCount(2);

  // Esc pauses; Resume returns focus to the board.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeHidden();
  await expect(target).toBeFocused();
});
