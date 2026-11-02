import { expect, test } from "vitest";
import { formatClock } from "./formatClock";

test.each([
  [0, "0:00"],
  [5, "0:05"],
  [59, "0:59"],
  [60, "1:00"],
  [3599, "59:59"],
  [3600, "1:00:00"],
  [3725, "1:02:05"],
])("%i s -> %s", (s, text) => {
  expect(formatClock(s)).toBe(text);
});
