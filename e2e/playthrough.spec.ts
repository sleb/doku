import { expect, type Locator, type Page, test } from "@playwright/test";
import { HOLD_DELAY_MS, HOLD_MS, HOLD_TOTAL_MS } from "../src/ui/board/hold";
import { cell, hearts, press } from "./helpers";
import { levelById } from "./levels";

const { size, solution } = levelById("demo-7");

// Margin for "nothing happened" waits, past the hold threshold.
const SETTLE_MS = HOLD_TOTAL_MS + 300;

/** Mouse-hold a cell until it commits (state assertion), then release. */
async function mouseHold(page: Page, target: Locator): Promise<void> {
  await target.hover();
  await page.mouse.down();
  await expect(target).toHaveAccessibleName(/, (face|wrong)$/);
  await page.mouse.up();
}

const dialog = (page: Page): Locator => page.getByRole("dialog");
const retry = (page: Page): Locator =>
  page.getByRole("button", { name: "Retry" });

async function expectFreshBoard(page: Page): Promise<void> {
  await expect(dialog(page)).toBeHidden();
  await expect(page.getByRole("button", { name: /, empty$/ })).toHaveCount(
    size * size,
  );
  await expect(page.getByRole("button", { name: /, wrong$/ })).toHaveCount(0);
  await expect(hearts(page, 3)).toBeVisible();
}

test("win playthrough", async ({ page }) => {
  await page.goto("/");

  // Mouse gesture: press and hold places the face.
  const first = cell(page, 0, solution[0]);
  await mouseHold(page, first);
  await expect(first).toHaveAccessibleName(/, face$/);

  for (let r = 1; r < size; r++) {
    await press(page, cell(page, r, solution[r]));
  }

  await expect(
    page.getByRole("heading", { name: "You solved it" }),
  ).toBeVisible();
  await expect(hearts(page, 3)).toBeVisible();

  await page.getByRole("button", { name: "Next level" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(
    page.getByRole("heading", { name: /^Level 2 of / }),
  ).toBeVisible();
  await expect(hearts(page, 3)).toBeVisible();
});

test("lose playthrough", async ({ page }) => {
  await page.goto("/");

  const wrong = [0, 1, 2].map((r) => cell(page, r, (solution[r] + 1) % size));
  for (const [i, target] of wrong.entries()) {
    await press(page, target);
    await expect(target).toHaveAccessibleName(/, wrong$/);
    await expect(target.locator("svg")).toBeVisible();
    await expect(hearts(page, 2 - i)).toBeVisible();
  }

  await expect(
    page.getByRole("heading", { name: "Out of hearts" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /, wrong$/ })).toHaveCount(3);

  await retry(page).click();
  await expectFreshBoard(page);
});

test("the board is inert behind the result dialog", async ({ page }) => {
  await page.goto("/");
  for (let r = 0; r < 3; r++) {
    await press(page, cell(page, r, (solution[r] + 1) % size));
  }
  await expect(
    page.getByRole("heading", { name: "Out of hearts" }),
  ).toBeVisible();
  await expect(retry(page)).toBeFocused();

  // Cells are also `aria-disabled`, which would mask a missing `inert`. Strip
  // it from every cell so only `inert` can keep the board unreachable.
  const other = cell(page, 5, solution[5]);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button[aria-label^="Row "]')) {
      b.removeAttribute("aria-disabled");
    }
  });
  await expect(other).toBeEnabled();
  expect(await other.evaluate((el) => el.closest("[inert]") !== null)).toBe(
    true,
  );
  expect(
    await other.evaluate((el) => (el.closest("[inert]") as HTMLElement).inert),
  ).toBe(true);

  await other.evaluate((el) => (el as HTMLElement).focus());
  await expect(retry(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(retry(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(retry(page)).toBeFocused();
  await expect(hearts(page, 0)).toBeVisible();
});

test("a short click toggles a mark and never places a face", async ({
  page,
}) => {
  await page.goto("/");
  const target = cell(page, 0, solution[0]);
  await target.click();
  await expect(target).toHaveAccessibleName(/, marked$/);
  await target.click();
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("a double-click toggles twice and places nothing", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await target.dblclick();
  await page.waitForTimeout(SETTLE_MS);
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("releasing before the hold completes places nothing", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await target.hover();
  await page.mouse.down();
  await page.waitForTimeout(HOLD_TOTAL_MS / 3);
  await page.mouse.up();
  await page.waitForTimeout(SETTLE_MS);
  await expect(target).not.toHaveAccessibleName(/, (face|wrong)$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("dragging off the cell cancels the hold", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await target.hover();
  await page.mouse.down();
  await expect(target).toHaveAttribute("data-holding", "true");
  await cell(page, 3, 3).hover();
  await expect(target).not.toHaveAttribute("data-holding", "true");
  await page.waitForTimeout(SETTLE_MS);
  await page.mouse.up();
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});

test("the glow shows while holding and is gone after commit", async ({
  page,
}) => {
  await page.goto("/");
  const target = cell(page, 0, solution[0]);
  await target.hover();
  await page.mouse.down();
  await expect(target).toHaveAttribute("data-holding", "true");
  await expect(page.locator("[data-hold-glow]")).toBeVisible();
  await expect(target).toHaveAccessibleName(/, face$/);
  await expect(page.locator("[data-hold-glow]")).toHaveCount(0);
  await page.mouse.up();
});

test("the glow is a finger-sized ring that sweeps mid-hold", async ({
  page,
}) => {
  await page.goto("/");
  const target = cell(page, 3, (solution[3] + 1) % size);
  await target.hover();
  await page.mouse.down();
  // Nothing shows during the delay, so a normal click never animates.
  await page.waitForTimeout(100);
  await expect(page.locator("[data-hold-glow]")).toHaveCount(0);
  await page.waitForTimeout(HOLD_DELAY_MS - 100);
  const glow = page.locator("[data-hold-glow]");
  const ring = glow.locator("circle.hold-ring");
  const read = () =>
    ring.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        offset: Number.parseFloat(cs.strokeDashoffset),
        dash: cs.strokeDasharray,
        width: el.getBoundingClientRect().width,
      };
    });
  await page.waitForTimeout(HOLD_MS * 0.3);
  const a = await read();
  await page.waitForTimeout(HOLD_MS * 0.3);
  const b = await read();
  expect(b.offset).toBeLessThan(a.offset);
  expect(a.dash).toBe("1px");
  const cellBox = await target.boundingBox();
  const glowBox = await glow.boundingBox();
  if (!cellBox || !glowBox) throw new Error("no box");
  // Wider than the fingertip-hidden cell: about 3 cells, floor 64 px.
  expect(glowBox.width).toBeGreaterThanOrEqual(
    Math.min(64, cellBox.width * 3) - 1,
  );
  expect(glowBox.width).toBeGreaterThan(cellBox.width * 1.5);
  // Centred on the held cell.
  expect(glowBox.x + glowBox.width / 2).toBeCloseTo(
    cellBox.x + cellBox.width / 2,
    0,
  );
  expect(glowBox.y + glowBox.height / 2).toBeCloseTo(
    cellBox.y + cellBox.height / 2,
    0,
  );
  await page.mouse.up();
});

test("the glow on a corner cell is not clipped by the board", async ({
  page,
}) => {
  await page.goto("/");
  const col = solution[0] === 0 ? 1 : 0;
  const target = cell(page, 0, col);
  await target.hover();
  await page.mouse.down();
  await expect(page.locator("[data-hold-glow]")).toBeVisible();
  await page.waitForTimeout(HOLD_MS * 0.6);
  const grid = await page.getByRole("grid").boundingBox();
  const glowBox = await page.locator("[data-hold-glow]").boundingBox();
  const cellBox = await target.boundingBox();
  if (!grid || !glowBox || !cellBox) throw new Error("no box");
  // The ring overflows the board's top edge...
  expect(glowBox.y).toBeLessThan(grid.y);
  // ...and its dark arc is actually painted there, above the frame.
  const h = Math.min(grid.y - glowBox.y, 20);
  const shot = await page.screenshot({
    clip: {
      x: cellBox.x + cellBox.width / 2,
      y: grid.y - h,
      width: cellBox.width,
      height: h - 1,
    },
  });
  const dark = await page.evaluate(async (png) => {
    const img = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${png}`)).blob(),
    );
    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, img.width, img.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] + d[i + 1] + d[i + 2] < 120) n++;
    return n;
  }, shot.toString("base64"));
  expect(dark).toBeGreaterThan(5);
  await page.mouse.up();
});

test("with reduced motion the ring is static and fades in", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const target = cell(page, 3, (solution[3] + 1) % size);
  await target.hover();
  await page.mouse.down();
  const ring = page.locator("[data-hold-glow] circle.hold-ring");
  await expect(ring).toBeVisible();
  const style = await ring.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { dash: cs.strokeDasharray, name: cs.animationName };
  });
  expect(style.dash).toBe("none");
  expect(style.name).toBe("hold-ramp");
  await page.mouse.up();
});

test("releasing Space early places nothing", async ({ page }) => {
  await page.goto("/");
  const target = cell(page, 0, (solution[0] + 1) % size);
  await target.focus();
  await page.keyboard.down("Space");
  await expect(target).toHaveAttribute("data-holding", "true");
  await page.waitForTimeout(HOLD_MS / 3);
  await page.keyboard.up("Space");
  await page.waitForTimeout(SETTLE_MS);
  await expect(target).toHaveAccessibleName(/, empty$/);
  await expect(hearts(page, 3)).toBeVisible();
});
