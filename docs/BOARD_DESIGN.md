# Doku Board — Low-Level Design (draft 1)

Companion to `DESIGN.md` §5 and §7 for milestone 2 ("Playable desktop board", tracking issue #38). This describes the store, the board UI, the HUD and the result modal: types, state transitions, component contracts, and tests. The engine (`docs/ENGINE_DESIGN.md`) is done and is consumed as-is; nothing here changes it.

## 1. Goal and scope

A player opens the desktop app, plays one level from start to finish, loses hearts on wrong taps, and reaches a win or lose result with a retry button.

In scope: Zustand game store, `<Board>`/`<Cell>`, `<Hearts>`/top bar, `<ResultModal>`, click input, Tailwind setup, test harness (RTL + Playwright).

Out of scope (milestone 3+): level select, persistence, undo/redo, hints, timer/stars, settings, keyboard navigation, right-click/drag marks, color-blind palette, mobile, wrong-tap animation.

Constraints carried from the design docs:

- The store never reimplements rules; it calls `judgeTap`, `isSolved`, `findConflicts` (`DESIGN.md` §4).
- The engine stays free of `ui`/`store`/`platform`/`@tauri-apps` imports (enforced by `engine/isolation.test.ts`). The dependency direction is `ui → store → engine`; `ui` may import engine types and `Cell`, never the reverse.
- Pre-MVP: no migrations, no compatibility shims. Change shapes freely.

## 2. Layout of new code

```
src/
├─ store/
│  ├─ game.ts            # pure state + transitions (no Zustand, no React)
│  ├─ game.test.ts
│  ├─ gameStore.ts       # thin Zustand binding: createGameStore(), useGameStore
│  └─ selectors.ts       # derived data (conflict cells, mark/face counts)
├─ ui/
│  ├─ board/
│  │  ├─ geometry.ts     # pure: per-cell region id + border flags from a Level
│  │  ├─ Board.tsx
│  │  ├─ Cell.tsx
│  │  ├─ icons.tsx       # FaceIcon, MarkIcon (inline SVG)
│  │  └─ palette.ts      # region class lookup + region names
│  ├─ hud/
│  │  ├─ Hearts.tsx
│  │  └─ TopBar.tsx
│  └─ screens/
│     ├─ GameScreen.tsx
│     └─ ResultModal.tsx
├─ levels/
│  └─ demo-7.json        # the one level M2 ships (copy of the 7×7 fixture)
├─ app/
│  └─ index.css          # @import "tailwindcss"; @theme tokens (region palette)
└─ App.tsx               # renders <GameScreen level={demoLevel}/>
e2e/
└─ playthrough.spec.ts
```

The Tauri scaffold in `App.tsx`/`App.css` (greet demo, logos) is deleted. The Rust `greet` command is left alone; removing it is a shell cleanup, not a board concern.

`src/levels/demo-7.json` is a copy of `uniqueLevel7`, loaded with `loadLevel`. Production code must not import from `engine/__fixtures__`, and a JSON file matches the planned level-pack format (`DESIGN.md` §10). Playwright imports the same JSON to learn the solution.

## 3. Store (`src/store`)

### 3.1 State

```ts
export const MAX_HEARTS = 3;

export type GameStatus = "idle" | "playing" | "won" | "lost";

export type GameState =
  | { status: "idle"; level: null; board: null; hearts: number }
  | {
      status: "playing" | "won" | "lost";
      level: Level;
      board: Board;      // never mutated; each change allocates a new array
      hearts: number;    // 0..MAX_HEARTS
    };
```

A discriminated union means components can narrow on `level !== null` once, instead of null-checking `board` everywhere. `conflicts` is not stored: it is derived (§3.4). `elapsedMs`, `history`, `hintsUsed` from `DESIGN.md` §5 arrive with their milestone-3 features.

### 3.2 Pure transitions (`game.ts`)

All logic is plain functions from state to state, so the state machine is tested without Zustand or React.

```ts
export const idleState: GameState;
export function startLevel(level: Level): GameState;   // playing, emptyBoard(level), MAX_HEARTS
export function tapCell(state: GameState, cell: number): GameState;  // flat row-major index
```

`restart(state)` is `startLevel(state.level)` and is a no-op on `idle`.

`tapCell` rules, in order:

1. `status !== "playing"` → return `state` unchanged (same reference).
2. Look at `board[cell]`:
   - **Empty → Mark.** Free. No judgement.
   - **Mark → Face or wrong.** `judgeTap(level, cell)`:
     - `correct`: place a face. Then, if `isSolved(board, level)` → `status: "won"`.
     - `wrong`: place nothing; the cell stays a mark (it already is the auto-mark from `DESIGN.md` §4). `hearts - 1`; if it reaches 0 → `status: "lost"`.
   - **Face → Empty.** Free. Faces on board are always correct (a wrong face is never placed), so removing one cannot create a dead end, and without undo this is the player's way to take back a mis-tap on a correct cell.
3. `judgeTap` only throws `RangeError` on the Mark branch, so `tapCell` validates the index up front (`Number.isInteger`, `0 ≤ cell < size²`) and throws `RangeError` itself. A caller bug then fails the same way on every cell state instead of silently succeeding on an Empty or Face cell. This check runs before rule 1 only when the state is `playing`.

Wrong tap and win/lose cannot coincide: a win needs a face placed, a loss needs a wrong tap, and one tap is only one of them.

Transition table:

| from | event | to |
|---|---|---|
| `idle` | `startLevel` | `playing` |
| `playing` | `tapCell` (correct, solves the puzzle) | `won` |
| `playing` | `tapCell` (wrong, last heart) | `lost` |
| `playing` | `tapCell` (anything else) | `playing` |
| `won`/`lost` | `restart` / `startLevel` | `playing` |
| `won`/`lost` | `tapCell` | unchanged |
| any | `startLevel(other)` | `playing` on `other` |

### 3.3 Zustand binding (`gameStore.ts`)

```ts
export interface GameStore extends ... {
  // state fields from GameState, plus:
  startLevel(level: Level): void;
  tapCell(cell: number): void;
  restart(): void;
}
export function createGameStore(): StoreApi<GameStore>;   // one per test
export const useGameStore: UseBoundStore<StoreApi<GameStore>>;  // app singleton
```

Each action is `set((s) => transition(s, ...))`. Action functions are created once, so their identity is stable and can be passed as props to memoized cells. The factory exists so each test gets a fresh store; the singleton is `createGameStore()` wrapped with `useStore`.

Components subscribe with narrow selectors (`useGameStore((s) => s.hearts)`) and never destructure the whole store.

### 3.4 Derived data (`selectors.ts`)

```ts
export function conflictCells(state: GameState): ReadonlySet<number>;  // flat indices
```

Flattens `findConflicts(board, level)` into a set of cell indices. Computed in `GameScreen` with `useMemo` on `[board, level]`, not stored.

**Known property:** because the store never places a wrong face, the faces on the board are always a subset of the solution, so `findConflicts` returns `[]` in every reachable state. The highlight path is built and tested (the issue asks for `findConflicts` to be wired in, and a future mode, such as hints or imported boards, may need it), but it is dormant in M2 and the UI test drives it by constructing a board directly. See open question 1.

## 4. Board UI (`src/ui/board`)

### 4.1 Geometry (`geometry.ts`, pure)

```ts
export interface CellGeometry {
  index: number;       // r * size + c
  row: number;
  col: number;
  region: number;
  // The border on this cell's right and bottom edge is thick when the neighbor
  // across it is in a different region. Top/left edges are drawn by the
  // neighbor (or by the board frame), so a shared edge is drawn exactly once.
  thickRight: boolean;
  thickBottom: boolean;
}
export function cellGeometry(level: Level): CellGeometry[];
```

Single-owner edges avoid the doubled-border problem you get when both cells draw the shared edge. The board container draws the outer frame.

### 4.2 `<Board>`

```ts
interface BoardProps {
  level: Level;
  board: Board;
  conflicts: ReadonlySet<number>;
  disabled: boolean;                 // status !== "playing"
  onTap(cell: number): void;         // stable identity
}
```

- `const geometry = useMemo(() => cellGeometry(level), [level])`.
- Renders `role="grid"` with `aria-label="Puzzle board"`, `aria-rowcount`/`aria-colcount`, and N `role="row"` wrappers using `display: contents` so the CSS grid sees the cells directly. Each `role="gridcell"` contains one `<button>` (the focusable, labelled element).
- Sizing: container sets `--n: {size}` and `--cell: min((100vw - 2rem) / var(--n), (100vh - 9rem) / var(--n), 4.5rem)`; `grid-template-columns: repeat(var(--n), var(--cell))`. At the default 800×600 window an 11×11 board is ≈ 40 px per cell, which stays tappable with a pointer.
- Tab order: every button is tabbable in M2 (no roving tabindex). Enter/Space work natively. Real keyboard navigation is milestone 3.

### 4.3 `<Cell>`

```ts
interface CellProps {
  index: number;
  row: number;
  col: number;
  region: number;
  thickRight: boolean;
  thickBottom: boolean;
  state: Cell;                 // engine enum: Empty | Mark | Face
  isConflict: boolean;
  disabled: boolean;
  onTap(index: number): void;
}
export const CellView = memo(function CellView(props: CellProps) { ... });
```

(Named `CellView` in code because `Cell` is the engine enum.)

- Pure presentational; never reads the store. All props are primitives or the stable `onTap`, so `memo` skips every cell except the one whose `state` changed. A tap re-renders `Board` (new `board` array) but only one `CellView`.
- Background from the region palette; `Mark` shows `<MarkIcon/>`, `Face` shows `<FaceIcon/>`; `isConflict` adds a ring.
- Label: `"Row {row+1}, column {col+1}, {regionName} region, {empty|marked|face}"` (matches `DESIGN.md` §7, which will be updated to say the label is on the button inside the gridcell).
- `disabled` sets the button's `disabled` attribute (won/lost), so the board is inert behind the result modal.

### 4.4 Palette (`palette.ts`, `app/index.css`)

Tailwind only generates classes it can see statically, so region colors are declared as theme tokens and looked up through a literal array:

```css
/* app/index.css */
@import "tailwindcss";
@theme {
  --color-region-0: ...;  /* … through --color-region-10 (11 regions max) */
}
```

```ts
export const REGION_BG = ["bg-region-0", ..., "bg-region-10"] as const;
export const REGION_NAMES = ["red", "orange", ..., ] as const;  // same order as the tokens
```

Hex values are chosen during implementation under two requirements: the 11 colors are pairwise distinguishable, and the face/mark glyph (dark stroke) reaches ≥ 3:1 contrast on every one. The color-blind variant and pattern overlay (`DESIGN.md` §7 Theming) are milestone 3/6, but tokens plus a lookup keep that a one-file swap.

## 5. HUD, result, screen

- **`<Hearts remaining max>`**: renders `max` heart icons, the first `remaining` filled. Container has `role="img"` and `aria-label="{remaining} of {max} hearts"`. Loss is a CSS transition on the icon's fill/scale (no JS animation).
- **`<TopBar level hearts>`**: level id/title on the left, `<Hearts>` on the right. Back button, timer, menu arrive in M3.
- **`<ResultModal status onRetry>`**: renders nothing unless `status` is `won` or `lost`. `div role="dialog" aria-modal="true" aria-labelledby`, heading "You solved it" / "Out of hearts", one **Retry** button (autofocused) calling `restart`. Plain `div`, not `<dialog>`: jsdom does not implement `showModal`, and the board is already inert via `disabled`. Win has no "next" button until level select exists.
- **`<GameScreen level>`**: on mount `startLevel(level)` in an effect (idempotent, so StrictMode's double-invoke is harmless); selects `status`, `board`, `hearts`; renders `TopBar`, `Board`, `ResultModal`. Renders nothing board-related while `idle`.

## 6. Dependencies and tooling

| Add | Why |
|---|---|
| `zustand` | store (decided, `DESIGN.md` §2) |
| `tailwindcss`, `@tailwindcss/vite` | styling (decided, §13.4); Tailwind v4, CSS-first config, plugin registered in `vite.config.ts` |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` | component tests |
| `@playwright/test` | e2e playthrough |

Vitest keeps the engine fast and Tauri-free by splitting into two projects:

- `node`: `src/engine/**`, `src/store/**`, `src/ui/**/geometry.test.ts`: no DOM.
- `dom` (jsdom, jest-dom setup file): `src/ui/**/*.test.tsx`, `src/App.test.tsx`.

`bun run test` runs both. Playwright runs via a separate `bun run test:e2e` against the Vite dev server on port 1420 (`webServer` in `playwright.config.ts`, `reuseExistingServer`). It is **not** part of `bun run check`, since it needs browser binaries; CI gets its own job.

## 7. Test plan (strict TDD: each row is written failing first)

Fixtures: `uniqueLevel7` for most store/UI tests (solution `[1,3,5,0,2,4,6]`). Helper `wrongCellFor(level)` returns any cell not in the solution; `solutionCells(level)` returns the flat indices.

**Store, node (`game.test.ts`)**

- `startLevel`: status `playing`, 3 hearts, empty board of N² cells, level retained.
- Tap empty → mark; no heart change.
- Tap mark on a solution cell → face; hearts unchanged.
- Tap mark on a non-solution cell → still mark, hearts − 1.
- Tap face → empty.
- Wrong tap from empty (first tap) is just a mark and costs nothing; the heart is only spent on the second tap.
- Three wrong second-taps → `lost`, hearts 0; further taps return the same state reference.
- All N solution cells placed (each via two taps) → `won`; board is exactly `isSolved`.
- Last correct face placement that wins leaves hearts as they were; a win with 1 heart left is `won`, not `lost`.
- `restart` after `won` and after `lost` → fresh `playing` state, 3 hearts.
- Out-of-range / non-integer index → `RangeError`, state unchanged.
- Input state is never mutated (reuse the engine's frozen-input approach: `Object.freeze` the previous state and board, assert the previous board still equals its snapshot).
- Store binding (`createGameStore`): actions update state; two stores don't share state.

**Selectors, node:** `conflictCells` flattens a hand-built board with an adjacent pair and a row conflict into the expected index set; empty for any board reachable through `tapCell`.

**Geometry, node:** on `uniqueLevel7`, thick edges appear exactly where regions differ (assert a few known cells plus a property test: `thickRight(i)` ⇔ regions differ from `i+1`, last column never thick on the right).

**Components, jsdom**

- `CellView`: renders empty/mark/face with the right label; `onTap(index)` fires on click; `disabled` blocks it; `isConflict` adds the ring; re-render with identical props does not re-render (spy via a render counter in a wrapper).
- `Board`: N rows × N gridcells; labels carry row, column, region name; region-border classes appear where `geometry` says; tapping one cell re-renders only that `CellView`.
- `Hearts`: `aria-label` for 3/2/0 remaining; correct number of filled icons.
- `ResultModal`: nothing for `playing`; correct heading for `won`/`lost`; Retry autofocused and calls `onRetry`.
- `GameScreen` (real store): clicking solution cells twice each shows the win dialog; three wrong second-taps show the lose dialog; Retry returns to a fresh board with 3 hearts.

**E2E, Playwright (`e2e/playthrough.spec.ts`)** against `demo-7.json`, locating cells by `aria-label` and reading the solution from the JSON:

1. Win: mark then place all 7 solution cells → "You solved it" → Retry → fresh board.
2. Lose: tap a non-solution cell once (mark, free), then three more times (one heart each) → "Out of hearts" → Retry.

## 8. Decisions

1. **Pure transitions + thin Zustand wrapper** over logic written inside `create()`. The state machine is a function table that tests call directly; the store adds only subscription.
2. **`GameState` is a discriminated union** (idle has no level/board), so UI code narrows once.
3. **Single-owner cell borders** (right/bottom + frame) instead of per-side borders on every cell, to avoid doubled region edges.
4. **Button inside gridcell**, rather than `role="gridcell"` on a button, to keep native button semantics. `DESIGN.md` §7 is updated accordingly.
5. **Plain `div role="dialog"`** over `<dialog>` for jsdom compatibility.
6. **Demo level as JSON in `src/levels`**, not imported from engine fixtures.

## 9. Open questions

1. **Conflict highlighting is dormant.** Since wrong faces are never placed, `findConflicts` can't fire in M2. Keep the wiring (cheap, issue asks for it), or drop `isConflict` until a feature can produce conflicts? Default: keep, as described in §3.4.
2. **Repeated taps on a known-wrong cell cost a heart each time.** After a wrong tap the cell is a mark, and tapping it again is judged again. This is the simplest reading of `DESIGN.md` §4 and punishes careless clicking. The alternative (remember revealed-wrong cells and ignore them) needs extra state; default: no.
3. **Face → empty on the third tap.** `DESIGN.md` says tap "cycles empty → mark → face" but doesn't say what follows face. Default: back to empty, so the cycle is closed.
4. **Should e2e run in CI on every push?** Adds a Playwright browser install to the pipeline. Default: yes, as a separate job from `check`.
