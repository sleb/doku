import { expect, type Page, test } from "@playwright/test";

const seed = (theme?: string) => (page: Page) =>
  page.addInitScript((t) => {
    if (t) {
      localStorage.setItem(
        "doku:settings",
        JSON.stringify({ seenTutorial: true, theme: t }),
      );
    }
  }, theme);

const dataTheme = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.theme);
const bodyBg = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const cellBg = (page: Page) =>
  page.evaluate(
    () =>
      getComputedStyle(document.querySelector('[role="gridcell"]') as Element)
        .backgroundColor,
  );

test("saved dark applies on load", async ({ page }) => {
  await seed("dark")(page);
  await page.goto("/?level=demo-11");
  expect(await dataTheme(page)).toBe("dark");
  expect(await bodyBg(page)).toBe("rgb(28, 25, 23)");
});

test("system follows the OS scheme live", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?level=demo-11");
  expect(await dataTheme(page)).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => dataTheme(page)).toBe("dark");
});

test("Light persists across reload and beats a dark OS", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Light" }).click();
  expect(await dataTheme(page)).toBe("light");
  await page.reload();
  expect(await dataTheme(page)).toBe("light");
  expect(await bodyBg(page)).toBe("rgb(255, 255, 255)");
});

test("region colours are the same in both themes", async ({ page }) => {
  await page.goto("/?level=demo-11");
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => dataTheme(page)).toBe("light");
  const light = await cellBg(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => dataTheme(page)).toBe("dark");
  expect(await cellBg(page)).toBe(light);
});
