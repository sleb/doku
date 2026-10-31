import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";

type Demo = { size: number; solution: number[] };

const demo = JSON.parse(
  readFileSync(new URL("../src/levels/demo-7.json", import.meta.url), "utf8"),
) as Demo;
const { size, solution } = demo;

const cell = (page: Page, r: number, c: number): Locator =>
  page.getByRole("button", {
    name: new RegExp(`^Row ${r + 1}, column ${c + 1},`),
  });

const hearts = (page: Page, n: number): Locator =>
  page.getByRole("img", { name: `${n} of 3 hearts` });

async function press(page: Page, target: Locator): Promise<void> {
  await target.focus();
  await page.keyboard.press("Space");
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

  // Mouse gesture: double-click places the face (mark, then face).
  const first = cell(page, 0, solution[0]);
  await first.dblclick();
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
