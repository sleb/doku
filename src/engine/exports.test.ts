import { expect, it } from "vitest";
import * as engine from "./index";

it("exports nextHint", () => {
  expect(typeof engine.nextHint).toBe("function");
});

it("exports makeRng", () => {
  expect(typeof engine.makeRng).toBe("function");
});
