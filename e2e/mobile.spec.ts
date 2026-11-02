import { expect, test } from "@playwright/test";
import { HOLD_TOTAL_MS } from "../src/ui/board/hold";
import {
  box,
  cell,
  expectBoardInViewport,
  hearts,
  open,
  touchClick,
  touchDown,
  touchHold,
  touchOut,
  touchUp,
} from "./helpers";
import { levelById } from "./levels";

const { size, solution } = levelById("demo-7");

const SETTLE_MS = HOLD_TOTAL_MS + 300;

test.use({ hasTouch: true });

for (const [w, h] of [
  [375, 667],
  [320, 568],
] as const) {
  test(`11x11 fits portrait ${w}x${h} with cells >= 22px`, async ({ page }) => {
    await open(page, w, h);
    await expectBoardInViewport(page);
    expect(
      (await box(page, "[role=grid] button")).width,
    ).toBeGreaterThanOrEqual(22);
  });
}

test("667x375 landscape puts the controls beside the board", async ({
  page,
}) => {
  await open(page, 667, 375);
  await expectBoardInViewport(page);
  const board = await box(page, "[role=grid]");
  const header = await box(page, "header");
  expect(header.x).toBeGreaterThanOrEqual(board.x + board.width - 0.5);
});

test("a tap toggles a mark and never shows the glow", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, solution[0]);
  await target.tap();
  await expect(target).toHaveAccessibleName(/, marked$/);
  await expect(target.locator("[data-hold-glow]")).toHaveCount(0);
  await expect(target).not.toHaveAttribute("data-holding", "true");
  await target.tap();
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("a 100ms touch press shows no glow and its click marks the cell", async ({
  page,
}) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await touchDown(target);
  await page.waitForTimeout(100);
  await expect(target.locator("[data-hold-glow]")).toHaveCount(0);
  await expect(target).not.toHaveAttribute("data-holding", "true");
  await touchUp(target);
  await touchClick(target);
  await expect(target).toHaveAccessibleName(/, marked$/);
  await page.waitForTimeout(SETTLE_MS);
  await expect(target).not.toHaveAccessibleName(/, (face|wrong)$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("touch-holding every solution cell wins", async ({ page }) => {
  await page.goto("/");
  for (let r = 0; r < size; r++) {
    const target = cell(page, r, solution[r]);
    await touchHold(target);
    await expect(target).toHaveAccessibleName(/, face$/);
  }
  await expect(
    page.getByRole("heading", { name: "You solved it" }),
  ).toBeVisible();
  await expect(hearts(page, 3)).toBeVisible();
});

test("a wrong touch hold costs a heart", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await touchHold(target);
  await expect(target).toHaveAccessibleName(/, wrong$/);
  await expect(hearts(page, 2)).toBeVisible();
});

test("dragging off mid-hold cancels", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await touchDown(target);
  await expect(target).toHaveAttribute("data-holding", "true");
  await touchOut(target, cell(page, 3, 3));
  await expect(target).not.toHaveAttribute("data-holding", "true");
  await page.waitForTimeout(SETTLE_MS);
  await touchUp(target);
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});
