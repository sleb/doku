import { expect, type Page, test } from "@playwright/test";
import { open, seed, solve, storageJson, storageValue } from "./helpers";
import { levelCount, levelIds } from "./levels";

type Progress = { next: number; bestMs: Record<string, number> };

const progress = (page: Page) => storageJson<Progress>(page, "progress");
const level = (page: Page, n: number) =>
  page.getByRole("heading", { name: `Level ${n} of ${levelCount}` });
const paused = (page: Page) => page.getByRole("dialog", { name: "Paused" });
const solved = (page: Page) =>
  page.getByRole("heading", { name: "You solved it" });

/** Progress as if every level before `next` was won in a minute. */
const progressAt = (next: number, extra: Record<string, number> = {}) => ({
  next,
  bestMs: {
    ...Object.fromEntries(levelIds.slice(0, next).map((id) => [id, 60000])),
    ...extra,
  },
});

test("progress survives a reload", async ({ page }) => {
  await page.goto("/");
  await solve(page, "demo-7");
  await expect(solved(page)).toBeVisible();
  await page.getByRole("button", { name: "Next level" }).click();
  await expect(level(page, 2)).toBeVisible();

  await expect.poll(async () => (await progress(page))?.next).toBe(1);
  expect((await progress(page))?.bestMs).toHaveProperty("demo-7");

  await page.reload();
  await expect(paused(page)).toBeVisible();
  await expect(level(page, 2)).toBeVisible();
});

test("the last level finishes the campaign", async ({ page }) => {
  const last = levelIds[levelCount - 1];
  await seed(page, "progress", progressAt(levelCount - 1));
  await page.goto("/");
  await expect(level(page, levelCount)).toBeVisible();

  await solve(page, last);
  await expect(solved(page)).toBeVisible();
  await expect(page.getByText("New best")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next level" })).toHaveCount(0);
  await page.getByRole("button", { name: "Finish" }).click();

  const finished = page.getByRole("heading", { name: "You finished" });
  await expect(finished).toBeVisible();
  // Seven bests of a minute plus a sub-minute win.
  await expect(page.getByText(/^Total of best times: 7:\d\d$/)).toBeVisible();
  await expect(page.getByRole("grid")).toHaveCount(0);
  await expect.poll(() => storageValue(page, "save")).toBeNull();
  const done = await progress(page);
  expect(done?.next).toBe(levelCount);

  // The Finale is a stable resting place across a reload.
  await page.reload();
  await expect(finished).toBeVisible();
  await expect(page.getByRole("grid")).toHaveCount(0);
  await expect(paused(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Start over" }).click();
  await expect(level(page, 1)).toBeVisible();
  await expect(page.getByRole("grid", { name: "Puzzle board" })).toBeVisible();
  await expect.poll(async () => (await progress(page))?.next).toBe(0);
  expect((await progress(page))?.bestMs).toEqual(done?.bestMs);
});

test("Start over in Settings asks first, then keeps best times", async ({
  page,
}) => {
  const seeded = progressAt(3);
  await seed(page, "progress", seeded);
  await page.goto("/");
  await expect(level(page, 4)).toBeVisible();

  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(
    page.getByText("Start over? Your best times are kept."),
  ).toBeVisible();

  // Escape backs out of the confirm only.
  await page.keyboard.press("Escape");
  await expect(settings).toBeVisible();
  await expect(
    page.getByText("Start over? Your best times are kept."),
  ).toHaveCount(0);
  expect((await progress(page))?.next).toBe(3);

  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  // Level 1 comes up paused, not running.
  await expect(paused(page)).toBeVisible();
  await expect(level(page, 1)).toBeVisible();
  await expect.poll(async () => (await progress(page))?.next).toBe(0);
  expect((await progress(page))?.bestMs).toEqual(seeded.bestMs);
});

test("the ?level= override records nothing", async ({ page }) => {
  await open(page, 800, 900, levelIds[levelCount - 1]);
  await solve(page, levelIds[levelCount - 1]);
  await expect(solved(page)).toBeVisible();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(solved(page)).toBeHidden();
  // A reload fires pagehide, which would flush a save if autosave were live.
  await page.reload();
  await expect(page.getByRole("grid", { name: "Puzzle board" })).toBeVisible();
  expect(await storageValue(page, "progress")).toBeNull();
  expect(await storageValue(page, "save")).toBeNull();
});

test("an unknown ?level= boots level 1", async ({ page }) => {
  await open(page, 800, 900, "nope");
  await expect(level(page, 1)).toBeVisible();
});
