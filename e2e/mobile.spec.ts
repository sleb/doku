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
import { resumeScenario } from "./resumeFlow";

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
  await expect(page.locator("[data-hold-glow]")).toHaveCount(0);
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
  await expect(page.locator("[data-hold-glow]")).toHaveCount(0);
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

test("reload resumes the whole game, paused, with touch input", async ({
  page,
}) => {
  await resumeScenario(
    page,
    (_, target) => touchHold(target),
    (target) => target.tap(),
  );
  // The Pause dialog fits and its buttons are tappable on this viewport.
  await page.getByRole("button", { name: "Pause" }).tap();
  const dialog = page.getByRole("dialog", { name: "Paused" });
  await expect(dialog).toBeVisible();
  const { width: vw, height: vh } = page.viewportSize() ?? {
    width: 0,
    height: 0,
  };
  const b = await dialog.boundingBox();
  if (!b) throw new Error("no dialog box");
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vw + 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(vh + 0.5);
  await page.getByRole("button", { name: "Resume" }).tap();
  await expect(dialog).toBeHidden();
});

test("with Tap: Face on, tapping every solution cell wins", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Tap places faces" }).tap();
  for (let r = 0; r < size; r++) await cell(page, r, solution[r]).tap();
  await expect(
    page.getByRole("heading", { name: "You solved it" }),
  ).toBeVisible();
});

test("the action bar row fits at 320px", async ({ page }) => {
  await open(page, 320, 568);
  const hint = await box(page, "button[aria-label^='Hint']");
  const tap = await box(page, "button[aria-label='Tap places faces']");
  expect(Math.max(hint.x + hint.width, tap.x + tap.width)).toBeLessThanOrEqual(
    320,
  );
  expect(tap.x).toBeGreaterThanOrEqual(0);
  expect(tap.height).toBeGreaterThanOrEqual(44);
  await expectBoardInViewport(page);
});
