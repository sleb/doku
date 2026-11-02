import { describe, expect, test } from "vitest";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { idleState, startLevel } from "./game";
import { toSaved } from "./persist";

describe("toSaved", () => {
  test("is null for idle", () => {
    expect(toSaved(idleState)).toBeNull();
  });
});
