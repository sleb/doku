import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

// The native title bar follows the OS (POLISH_DESIGN 12 Q5); the in-app override must not reach it.
test("no capability grants setting the window theme", () => {
  const dir = "src-tauri/capabilities";
  for (const f of readdirSync(dir)) {
    expect(readFileSync(`${dir}/${f}`, "utf8"), f).not.toMatch(/set-?theme/i);
  }
});
