import { expect, type Page, test } from "@playwright/test";
import { box, expectBoardInViewport, open } from "./helpers";

const firstCellWidth = async (page: Page) =>
  (await box(page, "[role=grid] button")).width;

for (const [w, h] of [
  [375, 667],
  [320, 568],
] as const) {
  test(`11x11 fits portrait ${w}x${h} with cells >= 22px`, async ({ page }) => {
    await open(page, w, h);
    await expectBoardInViewport(page);
    expect(await firstCellWidth(page)).toBeGreaterThanOrEqual(22);
  });
}

for (const [w, h] of [
  [667, 375],
  [1280, 800],
] as const) {
  test(`header sits beside the board at ${w}x${h}`, async ({ page }) => {
    await open(page, w, h);
    await expectBoardInViewport(page);
    const board = await box(page, "[role=grid]");
    const header = await box(page, "header");
    expect(header.x).toBeGreaterThanOrEqual(board.x + board.width - 0.5);
  });
}

test("header sits above the board at 800x800", async ({ page }) => {
  await open(page, 800, 800);
  await expectBoardInViewport(page);
  const board = await box(page, "[role=grid]");
  const header = await box(page, "header");
  expect(header.y + header.height).toBeLessThanOrEqual(board.y + 0.5);
});

test("resizing tall to wide at runtime switches layout and still fits", async ({
  page,
}) => {
  await open(page, 400, 800);
  let board = await box(page, "[role=grid]");
  let header = await box(page, "header");
  expect(header.y + header.height).toBeLessThanOrEqual(board.y + 0.5);
  await page.setViewportSize({ width: 900, height: 500 });
  await expect
    .poll(async () => (await box(page, "header")).x)
    .toBeGreaterThan(400);
  board = await box(page, "[role=grid]");
  header = await box(page, "header");
  expect(header.x).toBeGreaterThanOrEqual(board.x + board.width - 0.5);
  await expectBoardInViewport(page);
});

test("cells are capped at 4.5rem on a large viewport", async ({ page }) => {
  await open(page, 1280, 800);
  expect(await firstCellWidth(page)).toBeLessThanOrEqual(72.5);
});

test("360x300 stays stacked: board fits and cells are not smaller than stacked gives", async ({
  page,
}) => {
  await open(page, 360, 300);
  await expectBoardInViewport(page);
  const board = await box(page, "[role=grid]");
  const header = await box(page, "header");
  // Stacked: header above the board, not in a side column that squeezes it.
  expect(header.y + header.height).toBeLessThanOrEqual(board.y + 0.5);
  // The wide layout would give ~16px cells here; stacked gives ~20px.
  expect(await firstCellWidth(page)).toBeGreaterThanOrEqual(19);
});

test("stacked layout keeps >= 8px between header and board", async ({
  page,
}) => {
  await open(page, 400, 800);
  const header = await box(page, "[data-area=header]");
  const board = await box(page, "[data-area=board]");
  expect(board.y - (header.y + header.height)).toBeGreaterThanOrEqual(8);
});

test("wide layout keeps >= 8px between board and side column", async ({
  page,
}) => {
  await open(page, 1280, 800);
  const header = await box(page, "[data-area=header]");
  const board = await box(page, "[data-area=board]");
  expect(header.x - (board.x + board.width)).toBeGreaterThanOrEqual(8);
});

test("stacked layout reserves no phantom row below the board", async ({
  page,
}) => {
  await open(page, 400, 800);
  const board = await box(page, "[data-area=board]");
  const layout = await box(page, ".game-layout");
  expect(await page.locator("[data-area=controls]").count()).toBe(0);
  expect(layout.y + layout.height - (board.y + board.height)).toBeLessThan(0.5);
});

for (const [w, h] of [
  [667, 375],
  [932, 430],
] as const) {
  test(`landscape ${w}x${h}: group is centered, header stacked and centered beside the board`, async ({
    page,
  }) => {
    await open(page, w, h);
    const board = await box(page, "[role=grid]");
    const header = await box(page, "header");
    const title = await box(page, "header h1");
    const hearts = await box(page, "header [role=img]");
    // Title above hearts, with a gap.
    expect(hearts.y - (title.y + title.height)).toBeGreaterThanOrEqual(4);
    // Board + header form one group centered in the viewport.
    const left = board.x;
    const right = w - (header.x + header.width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(2);
    // Header column is vertically centered against the board.
    const mid = (b: { y: number; height: number }) => b.y + b.height / 2;
    expect(Math.abs(mid(header) - mid(board))).toBeLessThanOrEqual(2);
  });
}
