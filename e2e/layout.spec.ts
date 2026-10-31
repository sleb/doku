import { expect, type Page, test } from "@playwright/test";

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

async function expectBoardFits(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("grid", { name: "Puzzle board" })).toBeVisible();
  const vw = page.viewportSize()?.width ?? 0;
  const main = await box(page, "main");
  const board = await box(page, "[role=grid]");
  const bar = await box(page, "header");
  expect(board.x).toBeGreaterThanOrEqual(main.x - 0.5);
  expect(board.x + board.width).toBeLessThanOrEqual(main.x + main.width + 0.5);
  expect(board.x).toBeGreaterThanOrEqual(0);
  expect(board.x + board.width).toBeLessThanOrEqual(vw);
  const barCenter = bar.x + bar.width / 2;
  expect(Math.abs(board.x + board.width / 2 - barCenter)).toBeLessThanOrEqual(
    2,
  );
}

test("board fits and is centered on the TopBar at desktop size", async ({
  page,
}) => {
  await expectBoardFits(page);
});

test("board fits and is centered on the TopBar at a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await expectBoardFits(page);
});
