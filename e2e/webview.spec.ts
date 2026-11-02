import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { press } from "./helpers";

const { solution } = JSON.parse(
  readFileSync(new URL("../src/levels/demo-7.json", import.meta.url), "utf8"),
) as { solution: number[] };

const style = (page: Page, sel: string, prop: string) =>
  page.evaluate(
    ([s, p]) =>
      getComputedStyle(document.querySelector(s) as Element).getPropertyValue(
        p,
      ),
    [sel, prop],
  );

test("viewport meta covers the notch and keeps zoom available", async ({
  page,
}) => {
  await page.goto("/");
  const content = await page.evaluate(
    () =>
      document.querySelector<HTMLMetaElement>("meta[name=viewport]")?.content,
  );
  expect(content).toContain("width=device-width");
  expect(content).toContain("initial-scale=1");
  expect(content).toContain("viewport-fit=cover");
  expect(content).not.toContain("user-scalable");
});

test("no scroll, bounce or double-tap zoom", async ({ page }) => {
  await page.goto("/");
  for (const sel of ["html", "body"]) {
    expect(await style(page, sel, "overscroll-behavior")).toContain("none");
    expect(await style(page, sel, "overflow")).toBe("hidden");
  }
  expect(await style(page, "body", "touch-action")).toBe("manipulation");
  await page.mouse.move(5, 5);
  await page.mouse.wheel(0, 500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("text selection, magnifier and callout menu are disabled", async ({
  page,
}) => {
  await page.goto("/");
  expect(await style(page, "body", "user-select")).toBe("none");
  expect(await style(page, ".cell", "user-select")).toBe("none");
});

test("page background is opaque on html and body", async ({ page }) => {
  await page.goto("/");
  const html = await style(page, "html", "background-color");
  const body = await style(page, "body", "background-color");
  expect(html).not.toBe("rgba(0, 0, 0, 0)");
  expect(html).toBe(body);
});

test("main keeps a gutter of at least 0.5rem", async ({ page }) => {
  await page.goto("/");
  for (const side of ["top", "right", "bottom", "left"]) {
    const px = parseFloat(await style(page, "main", `padding-${side}`));
    expect(px).toBeGreaterThanOrEqual(8);
  }
});

test("main clears simulated safe-area insets", async ({ page }) => {
  await page.goto("/");
  await page.addStyleTag({
    content: ":root{--safe-top:40px;--safe-bottom:34px}",
  });
  expect(parseFloat(await style(page, "main", "padding-top"))).toBe(40);
  expect(parseFloat(await style(page, "main", "padding-bottom"))).toBe(34);
});

test("result overlay fills the viewport and the dialog clears insets", async ({
  page,
}) => {
  await page.goto("/");
  await page.addStyleTag({
    content: ":root{--safe-top:40px;--safe-bottom:34px}",
  });
  for (let r = 0; r < solution.length; r++) {
    const target = page.getByRole("button", {
      name: new RegExp(`^Row ${r + 1}, column ${solution[r] + 1},`),
    });
    await press(page, target);
  }
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const vp = page.viewportSize() as { width: number; height: number };
  const overlay = await dialog.locator("xpath=..").boundingBox();
  expect(overlay).toEqual({ x: 0, y: 0, width: vp.width, height: vp.height });
  const pad = await dialog
    .locator("xpath=..")
    .evaluate((el) => [
      getComputedStyle(el).paddingTop,
      getComputedStyle(el).paddingBottom,
    ]);
  expect(pad).toEqual(["40px", "34px"]);
  const d = await dialog.boundingBox();
  expect(d?.y).toBeGreaterThanOrEqual(40);
  expect((d?.y ?? 0) + (d?.height ?? 0)).toBeLessThanOrEqual(vp.height - 34);
});
