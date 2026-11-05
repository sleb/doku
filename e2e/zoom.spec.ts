import { expect, type Page, test } from "@playwright/test";
import { open } from "./helpers";
import { levelBySize } from "./levels";

test.skip(({ isMobile }) => isMobile, "desktop only");

const level = levelBySize(9).id;

const noHorizontalScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <= window.innerWidth &&
      document.body.scrollWidth <= window.innerWidth,
  );

async function expectBoardInWidth(page: Page) {
  const { width: vw } = page.viewportSize() ?? { width: 0 };
  const b = await page.locator("[role=grid]").boundingBox();
  expect(b).not.toBeNull();
  expect((b?.x ?? -1) >= 0).toBe(true);
  expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(vw + 0.5);
}

/** The dialog sits inside the viewport, its body scrolls, and Done is reachable. */
async function expectDialogUsable(page: Page, name: string) {
  const { width: vw, height: vh } = page.viewportSize() ?? {
    width: 0,
    height: 0,
  };
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible();
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const b = await dialog.boundingBox();
  expect((b?.x ?? -1) >= 0 && (b?.y ?? -1) >= 0).toBe(true);
  expect((b?.x ?? 0) + (b?.width ?? 0)).toBeLessThanOrEqual(vw + 0.5);
  expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(vh + 0.5);
  const done = dialog.getByRole("button", { name: /^(Done|Resume|Got it)$/ });
  await done.scrollIntoViewIfNeeded();
  const d = await done.boundingBox();
  expect((d?.y ?? -1) >= 0).toBe(true);
  expect((d?.y ?? 0) + (d?.height ?? 0)).toBeLessThanOrEqual(vh + 0.5);
  expect(await noHorizontalScroll(page)).toBe(true);
}

async function dialogs(page: Page) {
  await page.getByRole("button", { name: "Pause" }).click();
  await expectDialogUsable(page, "Paused");
  await page.getByRole("button", { name: "Settings" }).click();
  await expectDialogUsable(page, "Settings");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rules" }).click();
  await expectDialogUsable(page, "Rules");
}

test("root font size at 200% keeps the layout usable", async ({ page }) => {
  await open(page, 1280, 800, level);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  expect(await noHorizontalScroll(page)).toBe(true);
  await expectBoardInWidth(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const clipped = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>("header *, header")].filter(
        (el) =>
          el.scrollWidth > el.clientWidth + 1 &&
          getComputedStyle(el).overflowX !== "visible",
      ).length,
  );
  expect(clipped).toBe(0);
  await dialogs(page);
});

test("a halved viewport (200% page zoom layout) keeps the board inside", async ({
  page,
}) => {
  await open(page, 640, 400, level);
  await expectBoardInWidth(page);
  const b = await page.locator("[role=grid]").boundingBox();
  expect((b?.y ?? -1) >= 0).toBe(true);
  expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(400.5);
  await dialogs(page);
});
