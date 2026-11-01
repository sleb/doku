import { expect, type Locator, type Page } from "@playwright/test";

/** Hold Space on a focused cell until it commits (state assertion), then release. */
export async function press(page: Page, target: Locator): Promise<void> {
  await target.focus();
  await page.keyboard.down("Space");
  await expect(target).toHaveAccessibleName(/, (face|wrong)$/);
  await page.keyboard.up("Space");
}

export async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}

export async function open(
  page: Page,
  w: number,
  h: number,
  level = "demo-11",
) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`/?level=${level}`);
  await expect(page.getByRole("grid", { name: "Puzzle board" })).toBeVisible();
}

export async function expectBoardInViewport(page: Page) {
  const { width: vw, height: vh } = page.viewportSize() ?? {
    width: 0,
    height: 0,
  };
  const b = await box(page, "[role=grid]");
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vw + 0.5);
  expect(b.y + b.height).toBeLessThanOrEqual(vh + 0.5);
  const noScroll = await page.evaluate(
    () =>
      document.documentElement.scrollHeight <= window.innerHeight &&
      document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noScroll).toBe(true);
}

export const cell = (page: Page, r: number, c: number): Locator =>
  page.getByRole("button", {
    name: new RegExp(`^Row ${r + 1}, column ${c + 1},`),
  });

export const hearts = (page: Page, n: number): Locator =>
  page.getByRole("img", { name: `${n} of 3 hearts` });

type TouchEvt = "pointerdown" | "pointerup" | "pointerout" | "click";

/**
 * Dispatch a touch-typed PointerEvent (page.touchscreen only taps). Portable
 * across engines; synthetic events skip implicit touch capture, so the
 * pointerup/click pair is sent explicitly.
 */
async function fire(
  target: Locator,
  type: TouchEvt,
  related?: Locator,
): Promise<void> {
  const rel = related ? await related.elementHandle() : null;
  await target.evaluate(
    (el, a) => {
      const init = {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
      };
      if (a.type === "click") {
        el.dispatchEvent(new MouseEvent("click", init));
      } else {
        el.dispatchEvent(
          new PointerEvent(a.type, {
            ...init,
            button: a.type === "pointerdown" ? 0 : -1,
            relatedTarget: a.rel as Element | null,
          }),
        );
      }
    },
    { type, rel },
  );
}

export const touchDown = (t: Locator) => fire(t, "pointerdown");
export const touchOut = (t: Locator, to: Locator) => fire(t, "pointerout", to);

/** Release, then the click a real touch would synthesize. */
export async function touchUp(t: Locator): Promise<void> {
  await fire(t, "pointerup");
}

/** Touch-hold until the cell commits (state assertion), then release and click. */
export async function touchHold(_page: Page, target: Locator): Promise<void> {
  await touchDown(target);
  await expect(target).toHaveAccessibleName(/, (face|wrong)$/);
  await touchUp(target);
  await fire(target, "click");
}
