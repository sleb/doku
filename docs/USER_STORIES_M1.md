# Milestone 1 — Engine + Tests: User Stories

Scope per DESIGN.md §12: `types.ts`, `rules.ts`, `solver.ts`, and a few fixture levels for tests. Hints, techniques, difficulty, generator and seed are out of scope (milestones 3–4). Heart spending and state transitions belong to the store (milestone 2), but the pure rule that decides whether a tap is wrong (`judgeTap`) lives in the engine.

Milestone 1 ships no player-facing UI, so the personas are the people who consume the engine: the **UI/store developer** (milestone 2), the **level author** (milestone 4 generator), and the **maintainer** who must trust the engine. Each story's value to the eventual player is noted in its "so that."

---

### User Story M1-01:

- **Summary:** Typed level and board model so the store and UI share one vocabulary

#### Use Case:
- **As a** UI/store developer building the playable board
- **I want to** import `Level`, `Board`, `Cell` and `Coord` types from `src/engine`
- **so that** I can render and mutate game state with compile-time guarantees instead of ad-hoc shapes

#### Acceptance Criteria:
- **Scenario:** Developer constructs a level and an empty board from the exported types
- **Given:** the engine package exports `Level { id, size, regions, solution }` and `Cell = empty | mark | face`
- **and Given:** a fixture level of size 7
- **When:** I create a `Board` for that level using the engine's helper
- **Then:** I get a 7×7 board with every cell `empty`, and the code type-checks with no `any`

---

### User Story M1-02:

- **Summary:** Reject malformed or incorrect levels before they reach a player

#### Use Case:
- **As a** level author
- **I want to** have a level's shape and stored solution verified against the rules
- **so that** players never meet a puzzle whose stored answer is wrong, since wrong taps are judged against `solution`

#### Acceptance Criteria:
- **Scenario:** A level whose stored solution breaks a rule is rejected
- **Given:** a level whose `solution` places two faces in adjacent cells
- **and Given:** the verifier runs in a dev/test build
- **When:** I load the level
- **Then:** loading fails with an error naming the violated rule (`adjacent`) and the offending cells

- **Scenario:** A structurally invalid level is rejected
- **Given:** a level where `regions` is not N×N, or has other than N distinct regions
- **When:** I load the level
- **Then:** loading fails with an error describing which structural check failed

---

### User Story M1-03:

- **Summary:** Detect row and column conflicts

#### Use Case:
- **As a** UI/store developer
- **I want to** call `findConflicts` and learn which cells share a row or column with another face
- **so that** the player can see why their board is invalid

#### Acceptance Criteria:
- **Scenario:** Two faces in the same row
- **Given:** a board with faces at (2,1) and (2,5)
- **When:** I call `findConflicts(board, level)`
- **Then:** both cells are returned with reason `row`

- **Scenario:** Two faces in the same column
- **Given:** a board with faces at (0,3) and (4,3)
- **When:** I call `findConflicts(board, level)`
- **Then:** both cells are returned with reason `col`

---

### User Story M1-04:

- **Summary:** Detect two faces in one colored region

#### Use Case:
- **As a** UI/store developer
- **I want to** have `findConflicts` flag faces that share a region
- **so that** the player learns the one-face-per-region rule from feedback

#### Acceptance Criteria:
- **Scenario:** Two faces in the same region
- **Given:** a board with two faces in cells whose `regions` value is identical, in different rows and columns and not touching
- **When:** I call `findConflicts(board, level)`
- **Then:** both cells are returned with reason `region` and no other reason

---

### User Story M1-05:

- **Summary:** Detect touching faces, including diagonals

#### Use Case:
- **As a** UI/store developer
- **I want to** have `findConflicts` flag faces in neighboring cells
- **so that** the no-touching rule is enforced the same way on every platform

#### Acceptance Criteria:
- **Scenario:** Diagonally adjacent faces
- **Given:** a board with faces at (3,3) and (4,4), in different regions
- **When:** I call `findConflicts(board, level)`
- **Then:** both cells are returned with reason `adjacent`

- **Scenario:** A cell breaking several rules reports each one
- **Given:** a board with faces at (3,3) and (3,4), in the same region
- **When:** I call `findConflicts(board, level)`
- **Then:** the result includes `row`, `region` and `adjacent` conflicts, each listing both cells

- **Scenario:** Faces a knight's move apart are not adjacent
- **Given:** a board with faces at (3,3) and (5,4)
- **When:** I call `findConflicts(board, level)`
- **Then:** no `adjacent` conflict is returned

---

### User Story M1-06:

- **Summary:** Ignore marks and report a clean board as conflict-free

#### Use Case:
- **As a** UI/store developer
- **I want to** have `findConflicts` consider only faces
- **so that** the player's ✕ notes never trigger false highlights

#### Acceptance Criteria:
- **Scenario:** Marks never conflict
- **Given:** a board with many ✕ marks, including several in one row, column and region, and no faces
- **When:** I call `findConflicts(board, level)`
- **Then:** the result is empty

---

### User Story M1-07:

- **Summary:** Know exactly when the puzzle is won

#### Use Case:
- **As a** UI/store developer
- **I want to** call `isSolved(board, level)`
- **so that** the store can move to `won` at the right moment, and only then

#### Acceptance Criteria:
- **Scenario:** Complete valid placement is solved
- **Given:** a board holding exactly the N faces of `level.solution`
- **When:** I call `isSolved(board, level)`
- **Then:** it returns `true`

- **Scenario:** One face short is not solved
- **Given:** the solved board with one face removed
- **When:** I call `isSolved(board, level)`
- **Then:** it returns `false`

- **Scenario:** N faces with a conflict is not solved
- **Given:** a board with N faces where two share a row
- **When:** I call `isSolved(board, level)`
- **Then:** it returns `false`

---

### User Story M1-08:

- **Summary:** Solve any level from scratch

#### Use Case:
- **As a** level author
- **I want to** call `solve(level)` and get the placement
- **so that** I can check that a level is completable and that its stored solution matches

#### Acceptance Criteria:
- **Scenario:** Solver finds the stored solution of a uniquely solvable level
- **Given:** a valid fixture level with one solution
- **When:** I call `solve(level)`
- **Then:** it returns a placement equal to `level.solution`

- **Scenario:** Solver reports an unsolvable level
- **Given:** a fixture level with no valid placement
- **When:** I call `solve(level)`
- **Then:** it returns `null` (or the agreed "no solution" value) and does not throw

---

### User Story M1-09:

- **Summary:** Prove a level has exactly one solution

#### Use Case:
- **As a** level author
- **I want to** call `countSolutions(level, limit = 2)`
- **so that** I can reject ambiguous puzzles, since a wrong tap is defined as a deviation from the unique solution

#### Acceptance Criteria:
- **Scenario:** Unique level
- **Given:** a fixture level with exactly one solution
- **When:** I call `countSolutions(level, 2)`
- **Then:** it returns `1`

- **Scenario:** Ambiguous level stops early
- **Given:** a fixture level with several solutions
- **When:** I call `countSolutions(level, 2)`
- **Then:** it returns `2` without enumerating further solutions

---

### User Story M1-10:

- **Summary:** Fixture levels covering the cases the tests need

#### Use Case:
- **As a** maintainer
- **I want to** have a small set of fixture levels under the test tree
- **so that** every rule and solver path has a known-good or known-bad input to test against

#### Acceptance Criteria:
- **Scenario:** Fixture set is complete
- **Given:** the repo at the end of milestone 1
- **When:** I list the fixtures
- **Then:** they include at least one unique 7×7 level, one larger level (up to 11×11), one multi-solution level, and one no-solution level, each documented with its intended purpose

---

### User Story M1-11:

- **Summary:** Engine tests run fast without Tauri or a browser

#### Use Case:
- **As a** maintainer
- **I want to** run the engine's tests with Vitest alone
- **so that** I get quick feedback and the engine stays free of UI and platform dependencies

#### Acceptance Criteria:
- **Scenario:** Tests run in plain Node
- **Given:** a fresh checkout with dependencies installed
- **When:** I run the engine test command
- **Then:** all engine tests pass without launching Tauri or a DOM environment, and no file under `src/engine` imports from `src/ui`, `src/store`, `src/platform`, or `@tauri-apps/*`

---

### User Story M1-12:

- **Summary:** Solver and rules agree with each other

#### Use Case:
- **As a** maintainer
- **I want to** run a property test that cross-checks `solve` against `findConflicts`/`isSolved`
- **so that** a bug in one cannot hide behind the other

#### Acceptance Criteria:
- **Scenario:** Every solver output satisfies the rules
- **Given:** all solvable fixture levels
- **When:** I place the faces from `solve(level)` on an empty board and run `findConflicts` and `isSolved`
- **Then:** `findConflicts` returns empty and `isSolved` returns `true`

---

### User Story M1-13:

- **Summary:** Engine functions never mutate their inputs

#### Use Case:
- **As a** UI/store developer
- **I want to** pass boards and levels into the engine knowing they come back untouched
- **so that** undo/redo can be built from simple snapshots in milestone 3

#### Acceptance Criteria:
- **Scenario:** Inputs are unchanged after a call
- **Given:** a deep-frozen board and level
- **When:** I call `findConflicts`, `isSolved`, `solve` and `countSolutions` with them
- **Then:** no call throws a mutation error and the inputs deep-equal their original values

---

### User Story M1-14:

- **Summary:** Judge whether a tap is correct against the unique solution

#### Use Case:
- **As a** UI/store developer
- **I want to** call `judgeTap(level, cell)`
- **so that** the store can spend a heart on a wrong tap, and the rule defining a mistake lives in one place

#### Acceptance Criteria:
- **Scenario:** Tap on a solution cell is correct, any other is wrong
- **Given:** a fixture level with a known unique solution
- **When:** I call `judgeTap(level, cell)` for every cell
- **Then:** it returns `correct` for exactly the N solution cells and `wrong` for all others

---

## Suggested order

M1-01 → M1-10 (types and fixtures first) → M1-03…M1-06 → M1-07 → M1-14 → M1-02 → M1-08 → M1-09 → M1-12 → M1-13, with M1-11 set up at the start as the test harness.

## Decisions

1. **`solve` on an unsolvable level returns `null`** and does not throw. Unsolvable is an expected outcome when validating candidates, and the type forces callers to handle it.
2. **`judgeTap` lives in the engine** (`rules.ts`), as already specified in `docs/ENGINE_DESIGN.md` §4. The store calls it and spends the heart (M1-14).
3. **`findConflicts` may report several conflicts for the same cell.** Each `Conflict` is `{ cells, kind }`, so one cell can appear under multiple kinds (M1-05).
