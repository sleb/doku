import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("default Tauri capability", () => {
  it("grants the store plugin used by the storage seam", () => {
    const cap = JSON.parse(
      readFileSync("src-tauri/capabilities/default.json", "utf8"),
    );
    expect(cap.permissions).toContain("store:default");
  });
});
