import { describe, expect, test } from "vitest";
import { regionLabel, regionNamer } from "./regionNaming";

describe("regionNaming", () => {
  test("default palette without patterns uses colour names", () => {
    const o = { palette: "default", patterns: false } as const;
    expect(regionNamer(o)(0)).toBe("red");
    expect(regionLabel(0, o)).toBe("red region");
  });

  test.each([
    { palette: "accessible", patterns: false },
    { palette: "default", patterns: true },
  ] as const)("%j uses region numbers", (o) => {
    expect(regionNamer(o)(0)).toBeUndefined();
    expect(regionLabel(0, o)).toBe("region 1");
  });
});
