import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const { regions } = JSON.parse(
  readFileSync(new URL("../src/levels/demo-7.json", import.meta.url), "utf8"),
) as { regions: number[][] };

const cell = (page: Page, r: number, c: number) =>
  page.getByRole("button", {
    name: new RegExp(`^Row ${r + 1}, column ${c + 1},`),
  });

/**
 * Screenshots the page and returns the [start, end) of the dark (frame/grid
 * colored) pixel run that contains `at` along a 1px line, in CSS pixels
 * (device scale factor is 1). Implementation-agnostic: it measures paint.
 */
async function darkRun(
  page: Page,
  axis: "x" | "y",
  fixed: number,
  at: number,
): Promise<[number, number]> {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ png, axis, fixed, at }) => {
      const img = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${png}`)).blob(),
      );
      const canvas = new OffscreenCanvas(img.width, img.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0);
      const dark = (p: number) => {
        const [x, y] = axis === "x" ? [p, fixed] : [fixed, p];
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        return r + g + b < 3 * 100;
      };
      let lo = Math.round(at);
      // Allow a 3px search window in case `at` lands on an antialiased pixel.
      while (!dark(lo) && lo > at - 3) lo--;
      let hi = lo;
      while (dark(lo - 1)) lo--;
      while (dark(hi + 1)) hi++;
      return [lo, hi + 1] as [number, number];
    },
    { png, axis, fixed: Math.round(fixed), at },
  );
}

async function box(page: Page, r: number, c: number) {
  const b = await cell(page, r, c).boundingBox();
  if (!b) throw new Error(`no box for ${r},${c}`);
  return b;
}

test("thick region edges are centered on the thin grid line", async ({
  page,
}) => {
  await page.goto("/");
  await expect(cell(page, 1, 1)).toBeVisible();

  // Vertical edge: row 1, between col 1 (region 0) and col 2 (region 1).
  expect(regions[1][1]).not.toBe(regions[1][2]);
  const a = await box(page, 1, 1);
  // A thin line is a 1px border inside the cell, ending on the cell boundary.
  const thinX = a.x + a.width - 0.5;
  const [x0, x1] = await darkRun(page, "x", a.y + a.height / 2, thinX);
  expect(x1 - x0).toBeGreaterThanOrEqual(3);
  expect(Math.abs((x0 + x1) / 2 - thinX)).toBeLessThanOrEqual(1);

  // Horizontal edge: col 2, between row 0 (region 0) and row 1 (region 1).
  expect(regions[0][2]).not.toBe(regions[1][2]);
  const b = await box(page, 0, 2);
  const thinY = b.y + b.height - 0.5;
  const [y0, y1] = await darkRun(page, "y", b.x + b.width / 2, thinY);
  expect(y1 - y0).toBeGreaterThanOrEqual(3);
  expect(Math.abs((y0 + y1) / 2 - thinY)).toBeLessThanOrEqual(1);
});
