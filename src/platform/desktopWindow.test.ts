import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));

describe("desktop window config", () => {
  const win = () => json("src-tauri/tauri.conf.json").app.windows[0];

  it("cannot shrink below 420x560", () => {
    expect(win().minWidth).toBe(420);
    expect(win().minHeight).toBe(560);
  });

  it("opens at 800x600", () => {
    expect(win().width).toBe(800);
    expect(win().height).toBe(600);
  });
});

describe("desktop capability", () => {
  const cap = () => json("src-tauri/capabilities/desktop.json");

  it("applies only on desktop platforms", () => {
    expect(cap().platforms).toEqual(["macOS", "windows", "linux"]);
  });

  it("grants window-state to the main window", () => {
    expect(cap().windows).toContain("main");
    expect(cap().permissions).toContain("window-state:default");
  });
});

describe("capability isolation", () => {
  it.each(["default", "mobile"])(
    "%s capability has no window-state permission",
    (name) => {
      const cap = json(`src-tauri/capabilities/${name}.json`);
      expect(
        cap.permissions.filter((p: string) => p.startsWith("window-state:")),
      ).toEqual([]);
    },
  );
});

describe("Cargo.toml", () => {
  it("depends on window-state only in the desktop target table", () => {
    const toml = readFileSync("src-tauri/Cargo.toml", "utf8");
    const dep = 'tauri-plugin-window-state = "2"';
    const header =
      '[target.\'cfg(not(any(target_os = "android", target_os = "ios")))\'.dependencies]';
    const start = toml.indexOf(header);
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = toml.slice(start + header.length);
    const end = rest.indexOf("[");
    const table = end === -1 ? rest : rest.slice(0, end);
    expect(table).toContain(dep);
    expect(toml.indexOf(dep)).toBe(start + header.length + table.indexOf(dep));
  });
});
