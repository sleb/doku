import { expect, type Page, test } from "@playwright/test";
import { STEPS, type TutorialStep } from "../src/tutorial/steps";
import {
  box,
  cell,
  expectBoardInViewport,
  storageJson,
  storageValue,
} from "./helpers";

const fresh = { cookies: [], origins: [] };
const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const card = (page: Page) => page.getByTestId("tutorial-card");

/** Hold Space on a cell until it commits; highlighted cells carry a label suffix. */
async function hold(page: Page, step: TutorialStep, i: number) {
  const n = step.level.size;
  const target = cell(page, Math.floor(i / n), i % n);
  await target.focus();
  await page.keyboard.down("Space");
  await expect(target).toHaveAccessibleName(/, (face|wrong)/);
  await page.keyboard.up("Space");
}

/** Play one step by keyboard. */
async function playStep(page: Page, step: TutorialStep) {
  const n = step.level.size;
  for (const g of step.goal) {
    const target = cell(page, Math.floor(g.cell / n), g.cell % n);
    if (step.controls?.includes("hint")) {
      await page.keyboard.press("h");
    } else if (g.kind === "face" || g.kind === "wrong") {
      await hold(page, step, g.cell);
    } else {
      await target.focus();
      await page.keyboard.press("x");
      if (g.kind === "undone") await page.keyboard.press("z");
    }
  }
}

test.describe("first run", () => {
  test.use({ storageState: fresh });

  test("completes every step by keyboard and lands on level 1 paused", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(heading(page)).toHaveText(STEPS[0].title);
    await expect(page.getByRole("dialog")).toBeHidden();
    const save = await storageValue(page, "save");
    for (let i = 0; i < STEPS.length; i++) {
      await expect(heading(page)).toHaveText(STEPS[i].title);
      await expect(card(page)).toContainText(
        `Step ${i + 1} of ${STEPS.length}`,
      );
      await playStep(page, STEPS[i]);
    }
    // The last step stays up until Finish.
    await expect(heading(page)).toHaveText(STEPS[5].title);
    await expect(
      page.getByRole("button", { name: "Skip tutorial" }),
    ).toBeHidden();
    // The campaign was never touched while the tutorial ran.
    expect(await storageValue(page, "save")).toBe(save);
    expect(await storageValue(page, "progress")).toBeNull();
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Level 1 of / }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await storageJson<{ seenTutorial: boolean }>(page, "settings"))
            ?.seenTutorial,
      )
      .toBe(true);
    expect(await storageValue(page, "progress")).toBeNull();
  });

  test("a pointer hold completes step 1 and a slip explains itself", async ({
    page,
  }) => {
    await page.goto("/");
    const target = cell(page, 3, 1);
    await target.hover();
    await page.mouse.down();
    await expect(target).toHaveAccessibleName(/, face/);
    await page.mouse.up();
    await expect(heading(page)).toHaveText(STEPS[1].title);
    // Step 2: hold a cell that is not a goal.
    const s1 = STEPS[1];
    const wrong = cell(page, 3, 0);
    await wrong.hover();
    await page.mouse.down();
    await expect(page.getByTestId("on-wrong")).toHaveText(s1.onWrong);
    await page.mouse.up();
    // It resets to the same step, board intact.
    await expect(page.getByTestId("on-wrong")).toBeHidden();
    await expect(heading(page)).toHaveText(s1.title);
    await expect(wrong).toHaveAccessibleName(/, empty/);
  });

  test("every step fits a 320x568 phone with usable cells", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    for (let i = 0; i < STEPS.length; i++) {
      await expect(heading(page)).toHaveText(STEPS[i].title);
      await expectBoardInViewport(page);
      expect(
        (await box(page, "[role=grid] button")).width,
      ).toBeGreaterThanOrEqual(30);
      await playStep(page, STEPS[i]);
    }
  });

  test("Skip lands on level 1 paused and is remembered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Skip tutorial" }).click();
    await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
    await page.reload();
    await expect(heading(page)).not.toHaveText(STEPS[0].title);
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  });
});

test("Pause > Replay tutorial opens it and leaving returns to Pause", async ({
  page,
}) => {
  await page.goto("/");
  const progress = await storageValue(page, "progress");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Replay tutorial" }).click();
  await expect(heading(page)).toHaveText(STEPS[0].title);
  await page.getByRole("button", { name: "Skip tutorial" }).click();
  await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
  expect(await storageValue(page, "progress")).toBe(progress);
});
