import { expect, type Page } from "@playwright/test";
import { cell, hearts, storageJson } from "./helpers";
import { levelBySize } from "./levels";

const { size, solution } = levelBySize(7);

const seconds = (text: string | null): number =>
  (text ?? "").split(":").reduce((acc, p) => acc * 60 + Number(p), 0);

/**
 * Play part of level 1 (a face, a mark, a wrong cell), reload, and expect the
 * game back, paused, with the same board, hearts and a stopped clock. `hold`
 * places a face by the project's input kind (mouse/keyboard or touch).
 */
export async function resumeScenario(
  page: Page,
  hold: (page: Page, target: ReturnType<typeof cell>) => Promise<void>,
  mark: (target: ReturnType<typeof cell>) => Promise<void>,
): Promise<void> {
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("grid", { name: "Puzzle board" })).toBeVisible();

  const face = cell(page, 0, solution[0]);
  const marked = cell(page, 1, (solution[1] + 1) % size);
  const wrong = cell(page, 2, (solution[2] + 1) % size);

  await hold(page, face);
  await mark(marked);
  await expect(marked).toHaveAccessibleName(/, marked$/);
  // Let the clock run so the saved elapsed time is not zero.
  await page.clock.runFor(2000);
  await hold(page, wrong);
  await expect(wrong).toHaveAccessibleName(/, wrong$/);
  await expect(hearts(page, 2)).toBeVisible();

  await expect
    .poll(
      async () => (await storageJson<{ hearts: number }>(page, "save"))?.hearts,
    )
    .toBe(2);
  const before = seconds(await page.locator("time").textContent());

  await page.reload();
  const paused = page.getByRole("dialog", { name: "Paused" });
  await expect(paused).toBeVisible();
  await expect(page.getByRole("grid")).toBeHidden();
  await expect(hearts(page, 2)).toBeVisible();

  const time = page.locator("time");
  const resumedAt = seconds(await time.textContent());
  expect(resumedAt).toBeGreaterThanOrEqual(before);
  // Time passing while paused does not move the clock.
  await page.clock.runFor(3000);
  expect(seconds(await time.textContent())).toBe(resumedAt);

  await page.getByRole("button", { name: "Resume" }).click();
  await expect(paused).toBeHidden();
  await expect(face).toHaveAccessibleName(/, face$/);
  await expect(marked).toHaveAccessibleName(/, marked$/);
  await expect(wrong).toHaveAccessibleName(/, wrong$/);
  await expect(hearts(page, 2)).toBeVisible();
}
