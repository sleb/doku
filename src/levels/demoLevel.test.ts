import { describe, expect, test } from "vitest";
import { countSolutions, validateLevel } from "../engine";
import { uniqueLevel7, uniqueLevel11 } from "../engine/__fixtures__/levels";
import { demoLevel, demoLevel11 } from "./demoLevel";

describe("demoLevel", () => {
  test("is valid", () => {
    expect(validateLevel(demoLevel)).toEqual([]);
  });

  test("matches uniqueLevel7 apart from id", () => {
    expect({ ...demoLevel, id: "" }).toEqual({ ...uniqueLevel7, id: "" });
  });

  test("has exactly one solution", () => {
    expect(countSolutions(demoLevel)).toBe(1);
  });

  test("demoLevel11 matches uniqueLevel11 apart from id", () => {
    expect({ ...demoLevel11, id: "" }).toEqual({ ...uniqueLevel11, id: "" });
    expect(demoLevel11.id).toBe("demo-11");
  });
});
