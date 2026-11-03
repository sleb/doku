import { expect, test } from "vitest";
import { orderPackKeys } from "./packOrder";

test("orders packs by their numeric suffix, not as strings", () => {
  expect(
    orderPackKeys(["./pack-10.json", "./pack-2.json", "./pack-1.json"]),
  ).toEqual(["./pack-1.json", "./pack-2.json", "./pack-10.json"]);
});
