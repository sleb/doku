import { expect, test } from "vitest";

test("engine tests run in the node environment, with no DOM", () => {
  expect(typeof document).toBe("undefined");
  expect(typeof window).toBe("undefined");
});
