import { expect, type Page, test } from "@playwright/test";
import { open, solve } from "./helpers";
import { levelBySize } from "./levels";

const smallest = levelBySize(7);
const CONTROLS = "button, [role=switch], [role=radio], a, input";
const MIN = 44;
/** Board cells are exempt from 44 px: the board fills the viewport and an 11x11 grid cannot reach it. */
const CELL_FLOOR = 24;

async function settle(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
}

async function expectTargets(page: Page, where: string) {
  await settle(page);
  const small = await page.evaluate(
    ({ sel, min, floor }) => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (el.closest("[inert]")) continue;
        const isCell = el.closest("[role=gridcell]") !== null;
        const need = isCell ? floor : min;
        if (r.width < need - 0.5 || r.height < need - 0.5) {
          out.push(
            `${el.tagName} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
        }
      }
      return out;
    },
    { sel: CONTROLS, min: MIN, floor: CELL_FLOOR },
  );
  expect(small, where).toEqual([]);
}

/** The focused control's outline box lies inside every clipping (overflow) ancestor. */
async function expectRingNotClipped(page: Page) {
  const clipped = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return [];
    const cs = getComputedStyle(el);
    const grow =
      Number.parseFloat(cs.outlineWidth) + Number.parseFloat(cs.outlineOffset);
    const r = el.getBoundingClientRect();
    const ring = el.classList.contains("cell")
      ? r
      : {
          left: r.left - grow,
          top: r.top - grow,
          right: r.right + grow,
          bottom: r.bottom + grow,
        };
    const out: string[] = [];
    for (let a = el.parentElement; a; a = a.parentElement) {
      const o = getComputedStyle(a);
      if (o.overflowX === "visible" && o.overflowY === "visible") continue;
      if (a === document.documentElement || a === document.body) continue;
      const b = a.getBoundingClientRect();
      if (
        ring.left < b.left - 0.5 ||
        ring.right > b.right + 0.5 ||
        ring.top < b.top - 0.5 ||
        ring.bottom > b.bottom + 0.5
      )
        out.push(a.getAttribute("data-testid") ?? a.tagName);
    }
    return out;
  });
  expect(clipped).toEqual([]);
}

/** Tab through the page: every control that takes focus shows the focus-token outline. */
async function expectFocusRing(page: Page, where: string) {
  const tokens = await page.evaluate(() => {
    const read = (v: string) => {
      const probe = document.createElement("div");
      probe.style.color = `var(${v})`;
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    return { focus: read("--color-focus"), cell: read("--color-cell-focus") };
  });
  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      // Tab past the last control hands focus to the browser; the app then auto-pauses.
      if (!el || el === document.body || !document.hasFocus()) return null;
      const cs = getComputedStyle(el);
      return {
        id: `${el.tagName}:${el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 20)}`,
        // The tutorial heading takes programmatic focus; headings are not controls.
        heading: /^H\d$/.test(el.tagName),
        isCell: el.classList.contains("cell"),
        color: cs.outlineColor,
        style: cs.outlineStyle,
      };
    });
    if (!info) break;
    if (info.heading) continue;
    if (seen.has(info.id)) break;
    seen.add(info.id);
    expect(info.style, `${where} ${info.id}`).toBe("solid");
    expect(info.color, `${where} ${info.id}`).toBe(
      info.isCell ? tokens.cell : tokens.focus,
    );
    await expectRingNotClipped(page);
  }
  expect(seen.size, where).toBeGreaterThan(0);
}

test("board", async ({ page }) => {
  await open(page, 400, 800, smallest.id);
  await expectTargets(page, "board");
  await expectFocusRing(page, "board");
});

test("Pause, Settings and Rules", async ({ page }) => {
  await open(page, 400, 800, smallest.id);
  await page.getByRole("button", { name: "Pause" }).click();
  await expectTargets(page, "pause");
  await expectFocusRing(page, "pause");
  await page.getByRole("button", { name: "Rules" }).click();
  await expectTargets(page, "rules");
  await expectFocusRing(page, "rules");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings" }).click();
  await expectTargets(page, "settings");
  await expectFocusRing(page, "settings");
});

test("result modal", async ({ page }) => {
  await open(page, 400, 800, smallest.id);
  await solve(page, smallest.id);
  await page.keyboard.press("Shift");
  await expect(
    page.getByRole("dialog", { name: "You solved it" }),
  ).toBeVisible();
  await expectTargets(page, "result");
  await expectFocusRing(page, "result");
});

test.describe("tutorial", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("targets and focus ring", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("tutorial-card")).toBeVisible();
    await expectTargets(page, "tutorial");
    await expectFocusRing(page, "tutorial");
    // A highlighted cell keeps its focus ring while focused.
    const ring = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".cell[data-highlight]");
      if (!el) return null;
      el.focus();
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: cs.outlineWidth };
    });
    expect(ring).toEqual({ style: "solid", width: "3px" });
  });
});

test("cells keep a 24 px floor at the halved viewport", async ({ page }) => {
  await open(page, 640, 400, levelBySize(11).id);
  await expectTargets(page, "halved board");
});
