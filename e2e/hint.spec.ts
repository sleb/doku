import { expect, test } from "@playwright/test";
import { HINT_RING_MS } from "../src/ui/board/hintRing";
import { open } from "./helpers";
import { levelBySize } from "./levels";

const hint = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Hint, costs one heart" });

test("h explains the next deduction for a heart until the last heart", async ({
  page,
}) => {
  await open(page, 400, 800, levelBySize(7).id);
  const banner = page.getByTestId("hint-banner");
  await expect(page.getByRole("img", { name: "3 of 3 hearts" })).toBeVisible();
  await expect(banner).toHaveText("");

  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "2 of 3 hearts" })).toBeVisible();
  await expect(banner).toHaveText(/\S.*\.$/);
  await expect(page.locator("[data-hint]").first()).toBeVisible();
  await expect(hint(page)).toBeEnabled();

  // The same hint again is free; the board is unchanged for an elimination, and
  // a placement has already moved on to a new hint.
  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "1 of 3 hearts" })).toBeVisible();
  await expect(hint(page)).toBeDisabled();
  const shown = await banner.textContent();

  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "1 of 3 hearts" })).toBeVisible();
  await expect(banner).toHaveText(shown ?? "");
});

test("marking a cell clears the hint on display", async ({ page }) => {
  await open(page, 400, 800, levelBySize(7).id);
  await page.keyboard.press("h");
  await expect(page.getByTestId("hint-banner")).toHaveText(/\S/);
  await page.getByRole("button", { name: /Row 1, column 1,/ }).click();
  await expect(page.getByTestId("hint-banner")).toHaveText("");
  await expect(page.locator("[data-hint]")).toHaveCount(0);
});

test("a placement hint rings the new face for HINT_RING_MS, then the ring goes", async ({
  page,
}) => {
  await open(page, 400, 800, levelBySize(7).id);
  await page.keyboard.press("h");
  const ring = page.locator("[data-hint-ring]");
  await expect(ring).toBeVisible();
  await expect(ring).toHaveCount(1);
  // The explanation does not time out with the ring.
  await expect(ring).toBeHidden({ timeout: HINT_RING_MS + 1500 });
  await expect(page.getByTestId("hint-banner")).toHaveText(/\S/);
});

test("the announcer speaks the hint message, and the banner is not live", async ({
  page,
}) => {
  await open(page, 400, 800, levelBySize(7).id);
  await page.keyboard.press("h");
  const banner = page.getByTestId("hint-banner");
  await expect(banner).toHaveText(/\S/);
  await expect(banner).not.toHaveAttribute("role", "status");
  const message = (await banner.textContent()) ?? "";
  await expect(page.getByTestId("announcer")).toContainText(message);
  await expect(page.getByTestId("announcer")).toContainText("Face placed");
});

test("the ring still shows for its time under reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 400, 800, levelBySize(7).id);
  await page.keyboard.press("h");
  await expect(page.locator("[data-hint-ring]")).toBeVisible();
  await expect(page.locator("[data-hint-ring]")).toBeHidden({
    timeout: HINT_RING_MS + 1500,
  });
});

test("a refused hint ask does not speak or ring again", async ({ page }) => {
  await open(page, 400, 800, levelBySize(7).id);
  await page.keyboard.press("h");
  await page.keyboard.press("h");
  await expect(page.getByRole("img", { name: "1 of 3 hearts" })).toBeVisible();
  const said = await page.getByTestId("announcer").textContent();
  const rings = await page.locator("[data-hint-ring]").count();
  // One heart left: a refused ask changes nothing.
  await page.keyboard.press("h");
  await expect(page.getByTestId("announcer")).toHaveText(said ?? "");
  await expect(page.locator("[data-hint-ring]")).toHaveCount(rings);
});
