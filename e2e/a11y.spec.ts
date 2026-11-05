import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { open, solve } from "./helpers";
import { levelBySize } from "./levels";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];
const smallest = levelBySize(7);

/** Serious and critical violations fail; the rest are logged. */
async function audit(page: Page, where: string) {
  // Entrance animations fade the dialog; axe would sample blended colors.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    .analyze();
  for (const v of violations.filter(
    (x) => x.impact !== "serious" && x.impact !== "critical",
  )) {
    console.log(`axe ${v.impact} at ${where}: ${v.id} (${v.nodes.length})`);
  }
  const bad = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} [${v.impact}] ${v.nodes.map((n) => n.target).join(" | ")}`,
    );
  expect(bad, where).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.addInitScript((t) => {
        localStorage.setItem(
          "doku:settings",
          JSON.stringify({ haptics: true, seenTutorial: true, theme: t }),
        );
      }, scheme);
    });

    test("board", async ({ page }) => {
      await open(page, 400, 800, smallest.id);
      await audit(page, `board ${scheme}`);
    });

    test("Settings", async ({ page }) => {
      await open(page, 400, 800, smallest.id);
      await page.getByRole("button", { name: "Pause" }).click();
      await page.getByRole("button", { name: "Settings" }).click();
      await expect(
        page.getByRole("dialog", { name: "Settings" }),
      ).toBeVisible();
      await audit(page, `settings ${scheme}`);
    });

    test("Pause and Rules", async ({ page, isMobile }) => {
      test.skip(isMobile, "desktop only");
      await open(page, 400, 800, smallest.id);
      await page.getByRole("button", { name: "Pause" }).click();
      await expect(page.getByRole("dialog", { name: "Paused" })).toBeVisible();
      await audit(page, `pause ${scheme}`);
      await page.getByRole("button", { name: "Rules" }).click();
      await expect(page.getByRole("dialog", { name: "Rules" })).toBeVisible();
      await audit(page, `rules ${scheme}`);
    });

    test("result modal", async ({ page, isMobile }) => {
      test.skip(isMobile, "desktop only");
      await open(page, 400, 800, smallest.id);
      await solve(page, smallest.id);
      await page.keyboard.press("Shift"); // a key press skips the delay
      await expect(
        page.getByRole("dialog", { name: "You solved it" }),
      ).toBeVisible();
      await audit(page, `result ${scheme}`);
    });
  });

  test.describe(`${scheme} tutorial`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("tutorial", async ({ page, isMobile }) => {
      test.skip(isMobile, "desktop only");
      await page.emulateMedia({ colorScheme: scheme });
      await page.addInitScript((t) => {
        localStorage.setItem(
          "doku:settings",
          JSON.stringify({ seenTutorial: false, theme: t }),
        );
      }, scheme);
      await page.goto("/");
      await expect(page.getByTestId("tutorial-card")).toBeVisible();
      await audit(page, `tutorial ${scheme}`);
    });
  });
}
