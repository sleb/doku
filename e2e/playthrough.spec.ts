import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { HOLD_MS } from "../src/ui/board/hold";

type Demo = { size: number; solution: number[] };

const demo = JSON.parse(
  readFileSync(new URL("../src/levels/demo-7.json", import.meta.url), "utf8"),
) as Demo;
const { size, solution } = demo;

// Margin for "nothing happened" waits, past the hold threshold.
const SETTLE_MS = HOLD_MS + 300;

const cell = (page: Page, r: number, c: number): Locator =>
  page.getByRole("button", {
    name: new RegExp(`^Row ${r + 1}, column ${c + 1},`),
  });

const hearts = (page: Page, n: number): Locator =>
  page.getByRole("img", { name: `${n} of 3 hearts` });

/** Hold Space on a focused cell until it commits (state assertion), then release. */
async function press(page: Page, target: Locator): Promise<void> {
  await target.focus();
  await page.keyboard.down("Space");
  await expect(target).toHaveAccessibleName(/, (face|wrong)$/);
  await page.keyboard.up("Space");
}

/** Mouse-hold a cell until it commits (state assertion), then release. */
async function mouseHold(page: Page, target: Locator): Promise<void> {
  await target.hover();
  await page.mouse.down();
  await expect(target).toHaveAccessibleName(/, (face|wrong)$/);
  await page.mouse.up();
}

const dialog = (page: Page): Locator => page.getByRole("dialog");
const retry = (page: Page): Locator =>
  page.getByRole("button", { name: "Retry" });

async function expectFreshBoard(page: Page): Promise<void> {
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole("button", { name: /, empty$/ })).toHaveCount(
    size * size,
  );
  await expect(page.getByRole("button", { name: /, wrong$/ })).toHaveCount(0);
  await expect(hearts(page, 3)).toBeVisible();
}

test("win playthrough", async ({ page }) => {
  await page.goto("/");

  // Mouse gesture: press and hold places the face.
  const first = cell(page, 0, solution[0]);
  await mouseHold(page, first);
  await expect(first).toHaveAccessibleName(/, face$/);

  for (let r = 1; r < size; r++) {
    await press(page, cell(page, r, solution[r]));
  }

  await expect(
    page.getByRole("heading", { name: "You solved it" }),
  ).toBeVisible();
  await expect(hearts(page, 3)).toBeVisible();

  await retry(page).click();
  await expectFreshBoard(page);
});

test("lose playthrough", async ({ page }) => {
  await page.goto("/");

  const wrong = [0, 1, 2].map((r) => cell(page, r, (solution[r] + 1) % size));
  for (const [i, target] of wrong.entries()) {
    await press(page, target);
    await expect(target).toHaveAccessibleName(/, wrong$/);
    await expect(target.locator("svg")).toBeVisible();
    await expect(hearts(page, 2 - i)).toBeVisible();
  }

  await expect(
    page.getByRole("heading", { name: "Out of hearts" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /, wrong$/ })).toHaveCount(3);

  await retry(page).click();
  await expectFreshBoard(page);
});

test("the board is inert behind the result dialog", async ({ page }) => {
  await page.goto("/");
  for (let r = 0; r < 3; r++) {
    await press(page, cell(page, r, (solution[r] + 1) % size));
  }
  await expect(
    page.getByRole("heading", { name: "Out of hearts" }),
  ).toBeVisible();
  await expect(retry(page)).toBeFocused();

  // Cells are also `disabled`, which would mask a missing `inert`. Strip
  // `disabled` from every cell so only `inert` can keep the board unreachable.
  const other = cell(page, 5, solution[5]);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button[aria-label^="Row "]')) {
      b.removeAttribute("disabled");
    }
  });
  await expect(other).toBeEnabled();
  expect(await other.evaluate((el) => el.closest("[inert]") !== null)).toBe(
    true,
  );
  expect(
    await other.evaluate((el) => (el.closest("[inert]") as HTMLElement).inert),
  ).toBe(true);

  await other.evaluate((el) => (el as HTMLElement).focus());
  await expect(retry(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(retry(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(retry(page)).toBeFocused();
  await expect(hearts(page, 0)).toBeVisible();
});

test("a short click toggles a mark and never places a face", async ({
  page,
}) => {
  await page.goto("/");
  const target = cell(page, 0, solution[0]);
  await target.click();
  await expect(target).toHaveAccessibleName(/, marked$/);
  await target.click();
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("a double-click toggles twice and places nothing", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await target.dblclick();
  await page.waitForTimeout(SETTLE_MS);
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("releasing before the hold completes places nothing", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await target.hover();
  await page.mouse.down();
  await page.waitForTimeout(HOLD_MS / 3);
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
  await expect(target).not.toHaveAccessibleName(/, (face|wrong)$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("dragging off the cell cancels the hold", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await target.hover();
  await page.mouse.down();
  await expect(target).toHaveAttribute("data-holding", "true");
  await cell(page, 3, 3).hover();
  await expect(target).not.toHaveAttribute("data-holding", "true");
  await page.waitForTimeout(SETTLE_MS);
  await page.mouse.up();
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("the glow shows while holding and is gone after commit", async ({
  page,
}) => {
  await page.goto("/");
  const target = cell(page, 0, solution[0]);
  await target.hover();
  await page.mouse.down();
  await expect(target).toHaveAttribute("data-holding", "true");
  await expect(target.locator("[data-hold-glow]")).toBeVisible();
  await expect(target).toHaveAccessibleName(/, face$/);
  await expect(target.locator("[data-hold-glow]")).toHaveCount(0);
  await page.mouse.up();
});

test("releasing Space early places nothing", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await target.focus();
  await page.keyboard.down("Space");
  await expect(target).toHaveAttribute("data-holding", "true");
  await page.waitForTimeout(HOLD_MS / 3);
  await page.keyboard.up("Space");
  await page.waitForTimeout(SETTLE_MS);
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});
