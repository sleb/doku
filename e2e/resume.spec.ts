import { expect, test } from "@playwright/test";
import { cell, hearts, press, seedRaw, storageValue } from "./helpers";
import { levelById } from "./levels";
import { resumeScenario } from "./resumeFlow";

const { size, solution } = levelById("demo-7");

test("reload resumes the whole game, paused", async ({ page }) => {
  await resumeScenario(
    page,
    (p, target) => press(p, target),
    (target) => target.click(),
  );
});

const good = {
  levelId: "demo-7",
  board: Array(size * size).fill(0),
  wrong: [],
  hearts: 3,
  elapsedMs: 5000,
  hintsUsed: 0,
};

const bad: Array<[string, string]> = [
  ["a string", JSON.stringify("garbage")],
  ["a wrong-length board", JSON.stringify({ ...good, board: [0, 0, 0] })],
  ["another level's id", JSON.stringify({ ...good, levelId: "demo-11" })],
  ["zero hearts", JSON.stringify({ ...good, hearts: 0 })],
  ["unparsable JSON", "{"],
];

for (const [name, raw] of bad) {
  test(`a corrupt save (${name}) boots a fresh level`, async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (e) => errors.push(e));
    await seedRaw(page, "save", raw);
    await page.goto("/");
    await expect(
      page.getByRole("grid", { name: "Puzzle board" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("button", { name: /, empty$/ })).toHaveCount(
      size * size,
    );
    await expect(hearts(page, 3)).toBeVisible();
    await expect.poll(() => storageValue(page, "save")).not.toBe(raw);
    expect(errors).toEqual([]);
    // The fresh game is playable.
    const target = cell(page, 0, solution[0]);
    await press(page, target);
    await expect(target).toHaveAccessibleName(/, face$/);
  });
}
