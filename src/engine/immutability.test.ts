import { describe, expect, it } from "vitest";
import { type Fixture, fixtures } from "./__fixtures__/levels";
import { emptyBoard } from "./board";
import { findConflicts, isSolved, judgeTap } from "./rules";
import { countSolutions, solve } from "./solver";
import { type Board, Cell, type Level } from "./types";
import { LevelError, loadLevel, validateLevel } from "./validate";

// Object.freeze throws on a non-empty typed array, so a read-only board is a
// Proxy that rejects every write.
// Typed-array methods only work on the real target, so mutators are rejected
// by name.
const MUTATORS = new Set(["fill", "reverse", "set", "sort", "copyWithin"]);

function readOnlyBoard(cells: Uint8Array): Board {
  const reject = (what: string) => () => {
    throw new TypeError(`board is read-only: ${what}`);
  };
  return new Proxy(cells, {
    get(target, prop) {
      if (typeof prop === "string" && MUTATORS.has(prop)) {
        return reject(prop);
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set: reject("set"),
    defineProperty: reject("defineProperty"),
    deleteProperty: reject("deleteProperty"),
  });
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const cloneLevel = (level: Level): Level => structuredClone(level);

describe("test helpers", () => {
  it("readOnlyBoard rejects writes but allows reads", () => {
    const board = readOnlyBoard(Uint8Array.from([0, 1, 2]));
    expect(() => {
      (board as Uint8Array)[0] = 2;
    }).toThrow();
    expect(() => (board as Uint8Array).fill(1)).toThrow();
    expect(() => (board as Uint8Array).reverse()).toThrow();
    expect(board[1]).toBe(1);
    expect(board.length).toBe(3);
    expect(Array.from(board)).toEqual([0, 1, 2]);
  });

  it("deepFreeze rejects writes at every depth", () => {
    const level = deepFreeze(cloneLevel(fixtures[0].level));
    expect(() => {
      level.solution[0] = 99;
    }).toThrow();
    expect(() => {
      level.regions[0][0] = 99;
    }).toThrow();
    expect(() => level.solution.reverse()).toThrow();
  });
});

function boards(level: Level): Record<string, Uint8Array> {
  const n = level.size;
  const empty = new Uint8Array(emptyBoard(level));
  const placement = solve(level) ?? level.solution;
  const populated = new Uint8Array(empty);
  placement.forEach((c, r) => {
    populated[r * n + c] = Cell.Face;
  });
  populated[1] = populated[1] === Cell.Face ? Cell.Face : Cell.Mark;
  populated[n * n - 1] = populated[n * n - 1] || Cell.Mark;
  // Two faces in one column, two touching faces.
  const conflicting = new Uint8Array(empty);
  conflicting[0] = Cell.Face;
  conflicting[n] = Cell.Face;
  conflicting[n + 1] = Cell.Face;
  conflicting[3 * n] = Cell.Face;
  conflicting[4 * n] = Cell.Face;
  return { empty, populated, conflicting };
}

const levelArrays = (level: Level): unknown[] => [
  level.regions,
  ...level.regions,
  level.solution,
];

// loadLevel is excluded from the aliasing test: it returns its input by design.
// Only noSolutionLevel7 is expected to be rejected; any other LevelError fails.
const EXPECTED_REJECTED = "noSolutionLevel7";

describe.each(fixtures)(
  "inputs are never mutated: $name",
  (fixture: Fixture) => {
    const { name, level: source } = fixture;

    describe("level-only calls", () => {
      const level = deepFreeze(cloneLevel(source));
      const levelBefore = cloneLevel(source);

      const calls: Record<string, () => unknown> = {
        solve: () => solve(level),
        countSolutions: () => countSolutions(level),
        "countSolutions(limit 10)": () => countSolutions(level, 10),
        validateLevel: () => validateLevel(level),
        loadLevel: () => {
          if (name !== EXPECTED_REJECTED) return loadLevel(level);
          expect(() => loadLevel(level)).toThrow(LevelError);
        },
        emptyBoard: () => emptyBoard(level),
        judgeTap: () => {
          for (let i = 0; i < level.size * level.size; i++) judgeTap(level, i);
        },
      };

      it.each(Object.keys(calls))("%s", (callName) => {
        expect(() => calls[callName]()).not.toThrow();
        expect(level).toEqual(levelBefore);
      });
    });

    for (const [boardName, cells] of Object.entries(boards(source))) {
      describe(`${boardName} board`, () => {
        const level = deepFreeze(cloneLevel(source));
        const board = readOnlyBoard(cells);
        const levelBefore = cloneLevel(source);
        const boardBefore = Uint8Array.from(cells);

        const calls: Record<string, () => unknown> = {
          findConflicts: () => findConflicts(board, level),
          isSolved: () => isSolved(board, level),
        };

        it.each(Object.keys(calls))("%s", (callName) => {
          expect(() => calls[callName]()).not.toThrow();
          expect(level).toEqual(levelBefore);
          expect(Uint8Array.from(board)).toEqual(boardBefore);
        });
      });
    }

    it("returned values do not alias inputs", () => {
      const level = deepFreeze(cloneLevel(source));
      const arrays = levelArrays(level);

      const found = solve(level);
      expect(found).not.toBe(level.solution);
      if (found) expect(arrays).not.toContain(found);

      for (const [, cells] of Object.entries(boards(source))) {
        for (const conflict of findConflicts(readOnlyBoard(cells), level)) {
          expect(arrays).not.toContain(conflict.cells);
        }
      }

      const issues = validateLevel(level);
      expect(arrays).not.toContain(issues);
      for (const found of issues) expect(arrays).not.toContain(found.cells);

      const empty = emptyBoard(level);
      expect(emptyBoard(level)).not.toBe(empty);
    });
  },
);
