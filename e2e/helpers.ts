import { expect, type Locator, type Page } from "@playwright/test";

/** Hold Space on a focused cell until it commits (state assertion), then release. */
export async function press(page: Page, target: Locator): Promise<void> {
  await target.focus();
  await page.keyboard.down("Space");
  await expect(target).toHaveAccessibleName(/, (face|wrong)$/);
  await page.keyboard.up("Space");
}
