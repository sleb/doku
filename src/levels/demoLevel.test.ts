import { describe, expect, test } from "vitest";
import { countSolutions, validateLevel } from "../engine";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { demoLevel } from "./demoLevel";

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
});
