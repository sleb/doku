import { expect, type Page, test } from "@playwright/test";

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

async function open(page: Page, w: number, h: number, level = "demo-11") {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/?level=${level}`);
  await expect(page.getByRole("grid", { name: "Puzzle board" })).toBeVisible();
}

async function expectBoardInViewport(page: Page) {
  const { width: vw, height: vh } = page.viewportSize() ?? {
    width: 0,
    height: 0,
  };
  const board = await box(page, "[role=grid]");
  expect(board.x).toBeGreaterThanOrEqual(0);
  expect(board.y).toBeGreaterThanOrEqual(0);
  expect(board.x + board.width).toBeLessThanOrEqual(vw + 0.5);
  expect(board.y + board.height).toBeLessThanOrEqual(vh + 0.5);
  const noScroll = await page.evaluate(
    () =>
      document.documentElement.scrollHeight <= window.innerHeight &&
      document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noScroll).toBe(true);
}

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
