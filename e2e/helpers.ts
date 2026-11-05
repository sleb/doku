import { expect, type Locator, type Page } from "@playwright/test";
import { levelById, levelBySize } from "./levels";

/** Hold Space on a focused cell until it commits (state assertion), then release. */
export async function press(page: Page, target: Locator): Promise<void> {
  await target.focus();
  await page.keyboard.down("Space");
  await expect(target).toHaveAccessibleName(/, (face|wrong)(, highlighted)?$/);
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
  level = levelBySize(11).id,
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
  try {
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
              button: a.type === "pointerout" ? -1 : 0,
              relatedTarget: a.rel as Element | null,
            }),
          );
        }
      },
      { type, rel },
    );
  } finally {
    await rel?.dispose();
  }
}

export const touchDown = (t: Locator) => fire(t, "pointerdown");
export const touchOut = (t: Locator, to: Locator) => fire(t, "pointerout", to);

/** Release only (pointerup); a real touch's click is sent by `touchClick`. */
export const touchUp = (t: Locator) => fire(t, "pointerup");

/** The click a real touch synthesizes after pointerup (not sent after a drag-off). */
export const touchClick = (t: Locator) => fire(t, "click");

/** Touch-hold until the cell commits (state assertion), then release and click. */
export async function touchHold(target: Locator): Promise<void> {
  await touchDown(target);
  await expect(target).toHaveAccessibleName(/, (face|wrong)(, highlighted)?$/);
  await touchUp(target);
  await touchClick(target);
}

/** Seed a raw `localStorage["doku:"+key]` string before the app boots. */
export async function seedRaw(
  page: Page,
  key: string,
  raw: string,
): Promise<void> {
  await page.addInitScript(
    ([k, v]) => {
      // Once per tab: a later reload must keep the app's live state.
      const mark = `seeded:${k}`;
      if (sessionStorage.getItem(mark)) return;
      sessionStorage.setItem(mark, "1");
      localStorage.setItem(`doku:${k}`, v);
    },
    [key, raw],
  );
}

/** Seed `localStorage["doku:"+key]` with JSON before the app boots. */
export const seed = (page: Page, key: string, value: unknown) =>
  seedRaw(page, key, JSON.stringify(value));

/** The raw `doku:<key>` string, or null. */
export const storageValue = (page: Page, key: string): Promise<string | null> =>
  page.evaluate((k) => localStorage.getItem(`doku:${k}`), key);

/** Parsed `doku:<key>`, or null. */
export async function storageJson<T = unknown>(
  page: Page,
  key: string,
): Promise<T | null> {
  const raw = await storageValue(page, key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

/**
 * Hold-place the solution face in every row, optionally skipping rows (so the
 * level is left unsolved). Keyboard hold, which is portable across projects.
 */
export async function solve(
  page: Page,
  levelId: string,
  { skip = [] }: { skip?: number[] } = {},
): Promise<void> {
  const { size, solution } = levelById(levelId);
  for (let r = 0; r < size; r++) {
    if (skip.includes(r)) continue;
    await press(page, cell(page, r, solution[r]));
  }
}
