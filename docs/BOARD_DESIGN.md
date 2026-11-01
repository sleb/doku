# Doku Board — Low-Level Design (draft 1)

Companion to `DESIGN.md` §5 and §7 for milestone 2 ("Playable desktop board", tracking issue #38). This describes the store, the board UI, the HUD and the result modal: types, state transitions, component contracts, and tests. The engine (`docs/ENGINE_DESIGN.md`) is done and is consumed as-is; nothing here changes it.

## 1. Goal and scope

A player opens the desktop app, plays one level from start to finish, loses hearts on wrong taps, and reaches a win or lose result with a retry button.

In scope: Zustand game store, `<Board>`/`<Cell>`, `<Hearts>`/top bar, `<ResultModal>`, click input plus two cell keys (`x`, `Space`), Tailwind setup, test harness (RTL + Playwright).

Out of scope (milestone 3+): level select, persistence, undo/redo, hints, timer/stars, settings, arrow-key navigation, right-click and drag-to-paint marks, color-blind palette, mobile, wrong-tap animation.

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
│  └─ selectors.ts       # derived data (conflict cells)
├─ ui/
│  ├─ board/
│  │  ├─ geometry.ts     # pure: per-cell region id + border flags from a Level
│  │  ├─ Board.tsx
│  │  ├─ Cell.tsx
│  │  ├─ icons.tsx       # FaceIcon, WrongIcon (inline SVG)
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

`src/levels/demo-7.json` is a copy of `uniqueLevel7`, loaded with `loadLevel`. Production code must not import from `engine/__fixtures__`, and a JSON file matches the planned level-pack format (`DESIGN.md` §10). The Playwright spec reads it with `node:fs` and `JSON.parse` (path from `import.meta.url`); it does not import the JSON module.

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
      wrong: ReadonlySet<number>; // cells the player got wrong; each holds Cell.Mark in `board`, locked
      hearts: number;    // 0..MAX_HEARTS
    };
```

A discriminated union means components can narrow on `level !== null` once, instead of null-checking `board` everywhere. `board` holds two kinds of `Cell.Mark`: the player's own ✕ notes (free, editable) and wrong-face penalties; `wrong` tells them apart, so the latter render red and stay locked. `conflicts` is not stored: it is derived (§3.4). `elapsedMs`, `history`, `hintsUsed` from `DESIGN.md` §5 arrive with their milestone-3 features.

### 3.2 Pure transitions (`game.ts`)

All logic is plain functions from state to state, so the state machine is tested without Zustand or React.

```ts
export const idleState: GameState;
export function startLevel(level: Level): GameState;   // playing, emptyBoard(level), MAX_HEARTS
export function toggleMark(state: GameState, cell: number): GameState;  // flat row-major index
export function placeFace(state: GameState, cell: number): GameState;
```

`restart(state)` is `startLevel(state.level)` and is a no-op on `idle`.

Two gestures, two actions. A single tap toggles the player's ✕ note; pressing and holding places a face (§4.3 maps the gestures). Keeping the ✕ on a tap means a stray tap on a ✕ simply removes it; only a deliberate hold (250 ms delay, then a 500 ms glow trace) can commit a face.

Both actions start the same way:

1. `status !== "playing"` → return `state` unchanged (same reference).
2. Validate the index (`Number.isInteger`, `0 ≤ cell < size²`); otherwise throw `RangeError`, so a caller bug fails the same way for every cell state.
3. The cell is **locked** if it holds a `Face` or is in `wrong` → return `state` unchanged.

Then:

- **`toggleMark`**: `Empty ↔ Mark`. Free; never judged; never costs a heart. A ✕ on a solution cell is allowed (marks are notes, `DESIGN.md` §13.6).
- **`placeFace`**: works from `Empty` or from the player's own `Mark`. `judgeTap(level, cell)`:
  - `correct`: place a face (replacing any ✕). If `isSolved(board, level)` → `status: "won"`.
  - `wrong`: `hearts - 1`, set `Cell.Mark` and add the cell to `wrong` (it is now a locked red ✕). If hearts reach 0 → `status: "lost"`.

Because a wrong cell is locked, no cell can cost more than one heart. Faces and wrong ✕s are uneditable; only the player's own ✕ can be removed.

A wrong face and a win cannot coincide: a win needs a correct face and a loss needs a wrong one, and one action is only one of them.

Transition table:

| from | event | to |
|---|---|---|
| `idle` | `startLevel` | `playing` |
| `playing` | `placeFace` (correct, solves the puzzle) | `won` |
| `playing` | `placeFace` (wrong, last heart) | `lost` |
| `playing` | `placeFace` (any other unlocked cell), `toggleMark` | `playing` |
| `won`/`lost` | `restart` / `startLevel` | `playing` |
| `playing` | either action on a locked cell | unchanged |
| `won`/`lost` | `toggleMark`, `placeFace` | unchanged |
| any | `startLevel(other)` | `playing` on `other` |

### 3.3 Zustand binding (`gameStore.ts`)

```ts
export interface GameStore extends ... {
  // state fields from GameState, plus:
  startLevel(level: Level): void;
  toggleMark(cell: number): void;
  placeFace(cell: number): void;
  restart(): void;
}
export function createGameStore(): StoreApi<GameStore>;   // one per test
export const gameStore: StoreApi<GameStore>;                          // app singleton (tests reset it)
export function useGameStore<T>(selector: (s: GameStore) => T): T;   // useStore(gameStore, selector); also .getState()
```

`createGameStore` uses `createStore` from `zustand/vanilla`. M2-03 ships `startLevel` and `restart`, M2-04 adds `toggleMark` and M2-05 adds `placeFace`; the `gameStore` / `useGameStore` singleton landed in M2-10 (#49). An idle state has `hearts: MAX_HEARTS`.

Each action is `set((s) => transition(s, ...))`. Action functions are created once, so their identity is stable and can be passed as props to memoized cells. The factory exists so each test gets a fresh store; the singleton is `gameStore = createGameStore()` and `useGameStore` wraps it with `useStore`.

Components subscribe with narrow selectors (`useGameStore((s) => s.hearts)`) and never destructure the whole store.

### 3.4 Derived data (`selectors.ts`)

```ts
export function conflictCells(board: Board, level: Level): ReadonlySet<number>;  // flat indices
```

Flattens `findConflicts(board, level)` into a set of cell indices. M2-10 changed the signature from `(state)` to `(board, level)`: the idle check moved to the caller. Computed in `GameScreen` with `useMemo` on `[board, level]`, not stored and not a zustand selector (it returns a fresh `Set`).

**Known property:** because a wrong tap places a red ✕ rather than a face, the faces on the board are always a subset of the solution, so `findConflicts` returns `[]` in every reachable state. The highlight path is built and tested (the issue asks for `findConflicts` to be wired in, and a future mode, such as hints or imported boards, may need it), but it is dormant in M2 and the UI test drives it by constructing a board directly. See open question 1.

## 4. Board UI (`src/ui/board`)

**Landed in M2-07 (#46):** `geometry.ts`, `selectors.ts` (`conflictCells`), `icons.tsx`, `Cell.tsx`, `Board.tsx`. Input was added in M2-08. Conflicts show as a ring class plus `data-conflict="true"` and are not part of the label (the label vocabulary is `empty|marked|face|wrong`). `WRONG_COLOR` (`#7f1d1d`, in `palette.ts`) is the wrong-tap red, chosen by computing 3:1 against all 11 region colors (a brighter red fails on indigo). The grid role and ARIA props are spread from an object, and row/gridcell carry `biome-ignore` comments, to satisfy the a11y lints (native table elements do not fit a CSS grid).

**Landed in M2-08 (#47):** `Board` now also takes `disabled` (status is not `playing`), `onToggleMark` and `onPlaceFace`; `CellView` takes `disabled` plus the two callbacks. `Board` derives each cell's `disabled` as `disabled || isLocked(board, wrong, index)`, where `isLocked` is the predicate exported from `store/game.ts` that `toggleMark`/`placeFace` also use and passes it as a primitive, passing the callbacks through untouched so `memo` holds (callbacks must be stable, e.g. taken from `store.getState()`). The player's own mark stays enabled. (Gesture handling in `CellView` was reworked in #55; see the paragraph below and §4.3.) A cell that becomes a face or wrong mark turns disabled while focused and loses focus, so a keyboard player must Tab back in; accepted for M2 (arrow navigation and focus handling are milestone 4). The `useGameStore` singleton landed in M2-10.

**Landed in #55:** the double-click gesture was replaced by press-and-hold (see §4.3 and §8.8). `CellView` now uses `useHold`; `onClick` always toggles (the `detail >= 2` rule and the Space-places-immediately behavior from M2-08 are gone); Space places a face only after a hold. Tests drive holds with fake timers and `fireEvent.pointer*` via the shared `src/test/hold.ts` helper.

### 4.1 Geometry (`geometry.ts`, pure)

```ts
export interface CellGeometry {
  index: number;       // r * size + c
  row: number;
  col: number;
  region: number;
  // The edge on this cell's right and bottom is thick when the neighbor across
  // it is in a different region. Top/left edges belong to the neighbor (or the
  // board frame), so each shared edge has exactly one owner and one segment.
  thickRight: boolean;
  thickBottom: boolean;
}
export function cellGeometry(level: Level): CellGeometry[];
```

Single-owner edges mean each shared edge yields exactly one overlay segment. Cells draw only the thin 1px right/bottom grid border; `Board` renders each thick edge as an absolutely positioned, `aria-hidden` segment (`data-edge="right|bottom"`, `data-row`, `data-col`) after the cells, 4px wide and centered on the thin line (`boundary - 0.5px`), extended 2px past each end so corners join square. A border on one cell would sit wholly inside it and look offset from the thin line; the overlay straddles it with no layout shift and paints above fills and thin lines. The board container draws the outer frame. `e2e/borders.spec.ts` verifies the centering from screenshot pixels.

### 4.2 `<Board>`

```ts
interface BoardProps {
  level: Level;
  board: Board;
  conflicts: ReadonlySet<number>;
  wrong: ReadonlySet<number>;
  disabled: boolean;                 // status !== "playing"
  onToggleMark(cell: number): void; // stable identity
  onPlaceFace(cell: number): void;  // stable identity
}
```

- `const geometry = useMemo(() => cellGeometry(level), [level])`.
- Renders `role="grid"` with `aria-label="Puzzle board"`, `aria-rowcount`/`aria-colcount`, and N `role="row"` wrappers using `display: contents` so the CSS grid sees the cells directly. Each `role="gridcell"` contains one `<button>` (the focusable, labelled element).
- Sizing: the board sizes from its own container, not the viewport. `GameLayout` (`src/ui/screens/GameLayout.tsx`) puts the board in a `container-type: size` area (`.game-board-area`, no padding of its own) inside a full-height `main` (`h-dvh`, also a size container) whose padding is the safe-area gutter (`--safe-*` tokens in `src/app/index.css`). Container sets `--n: {size}` and `--cell: min((100cqw - 8px) / var(--n), (100cqh - 8px) / var(--n), 4.5rem)` (8px = the frame `border-4` in `Board.tsx`; keep them in sync); `grid-template-columns: repeat(var(--n), var(--cell))`. Tall layouts stack header, board, controls; at container aspect >= 1.2 and width >= 36rem the header and controls move to a side column. An 11x11 board fits without scrolling at 320x568 (cells ~26 px).
- Tab order: every button is tabbable in M2 (no roving tabindex). Enter/Space work natively. Real keyboard navigation is milestone 4.

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
  isWrong: boolean;            // a Mark that was a mistake: red ✕, locked
  // the player's own Mark (state === Mark && !isWrong) is editable
  isConflict: boolean;
  disabled: boolean;
  onToggleMark(index: number): void;
  onPlaceFace(index: number): void;
}
export const CellView = memo(function CellView(props: CellProps) { ... });
```

(Named `CellView` in code because `Cell` is the engine enum.)

- Pure presentational; never reads the store. All props are primitives or the stable callbacks, so `memo` skips every cell except the one whose `state` changed. A change re-renders `Board` (new `board` array) but only one `CellView`.
- Background from the region palette; `Face` shows `<FaceIcon/>`; a `Mark` shows `<MarkIcon/>` (neutral ✕), or with `isWrong` `<WrongIcon/>`, a red ✕ (the red must keep ≥ 3:1 contrast on every region color, same requirement as the glyphs below); `isConflict` adds a ring.
- Gesture mapping: a short click or tap toggles the player's ✕ (`onClick` always calls `onToggleMark(index)`; double-click simply toggles twice). Pressing and holding for `HOLD_DELAY_MS` (250) plus `HOLD_MS` (500) (`hold.ts`; `HOLD_TOTAL_MS` is the sum) calls `onPlaceFace(index)` once. The `useHold` hook (`useHold.ts`) owns the two chained timers (the delay, then the trace), the `holding` state, which turns on only after the delay so a plain click never shows the glow, and a `completed` flag; `pointerdown` (primary button, not disabled) starts it, and `pointerup`, `pointercancel`, `pointerleave` and `blur` cancel it. A completed pointer hold swallows its trailing click (the flag resets on the next `pointerdown`, on `pointerleave`, on any keydown, and when the click is swallowed, so a trailing click that never arrives cannot swallow a later Enter click; `start` returns early while a timer runs, so a second input source cannot disturb state). Touch pointers are implicitly captured, which would suppress `pointerleave`, so `pointerdown` releases capture (guarded for engines without the API) so dragging off cancels on touch too. Keyboard: `Space` keydown (no ctrl/meta/alt, not `repeat`) starts the same hold, keyup and blur cancel it, repeats and the Space keyup are `preventDefault`ed; `x` toggles immediately; Enter keeps its native click (toggle) and does not hold. Disabled cells get no hold, a hold is cancelled if the cell becomes disabled, and the timer is cleared on unmount.
- Hold feedback: once the delay has passed and until commit, the button has `data-holding="true"` and contains a `pointer-events-none` SVG `<rect pathLength=1>` (`data-hold-glow`) whose stroke is traced once around the border by `@keyframes hold-trace` (`index.css`), with the duration set inline from `HOLD_MS` so timer and glow cannot drift. Under `prefers-reduced-motion` the rect is a full outline ramping opacity over `HOLD_MS` (`hold-ramp`); the timers are unchanged. The glow mounts only after the delay, so its CSS animation starts then and stays in sync with the timer. Cells are `touch-none select-none` and carry the `.cell` class (`index.css`), which sets `-webkit-touch-callout: none` and a transparent tap highlight (scoped to cells, not every button), with and `contextmenu` prevented, so mobile does not select text or open a callout.
- Label: `"Row {row+1}, column {col+1}, {regionName} region, {empty|marked|face|wrong}"` (matches `DESIGN.md` §7, which will be updated to say the label is on the button inside the gridcell).
- `disabled` sets the button's `disabled` attribute. `Board` passes `disabled = status !== "playing" || isLocked(board, wrong, index)` (`isLocked` from `store/game.ts`, the same rule the actions use), so faces, wrong ✕s and the whole board behind the result modal are inert. The player's own ✕ stays enabled so it can be removed.

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

Implemented in M2-02: the hex values are Tailwind-300-ish pastels (red, orange, amber, lime, emerald, teal, sky, indigo, violet, pink, stone), `palette.ts` also exports `GLYPH_COLOR` (`#1f1f1f`), and a node test enforces the two requirements below. The temporary swatch strip in `App.tsx` was removed in M2-10; the e2e test now checks the token against a real board cell's `.bg-region-N` background. The demo level is `src/levels/demo-7.json` (a copy of `uniqueLevel7`, id `demo-7`) exported as `demoLevel` from `src/levels/demoLevel.ts`. Biome needs `css.parser.tailwindDirectives` enabled.

Hex values were chosen under two requirements: the 11 colors are pairwise distinguishable, and the face/mark glyph (dark stroke) reaches ≥ 3:1 contrast on every one. The color-blind variant and pattern overlay (`DESIGN.md` §7 Theming) are milestone 3/6, but tokens plus a lookup keep that a one-file swap.

## 5. HUD, result, screen

- **`<Hearts remaining max>`**: renders `max` heart icons, the first `remaining` filled. Container has `role="img"` and `aria-label="{remaining} of {max} hearts"`. Loss is a CSS transition on the icon's fill/scale (no JS animation).
- **`<TopBar level hearts>`**: level id/title on the left, `<Hearts>` on the right. Back button, timer, menu arrive in M3.
- **Landed in M2-09 (#48):** `src/ui/hud/Hearts.tsx` (with a private `HeartIcon`) and `src/ui/hud/TopBar.tsx`. Each icon carries `data-filled="true|false"` (filled = `fill-current`, empty = `fill-transparent` stroke only and `scale-90`, with `transition-[scale,fill,stroke]` and `motion-reduce:transition-none`; Tailwind v4 compiles `scale-90` to the standalone `scale` property, not `transform`, and `fill-none` cannot interpolate, hence both choices) and is `aria-hidden`; only the container is exposed. `Hearts` is presentational and does not clamp. `TopBar` shows `level.id` because `Level` has no title field, and takes `max` from `MAX_HEARTS` in `store/game`. `TopBarPlay.test.tsx` covers "wrong face shows 2 hearts" with a harness over a real `createGameStore()`; `GameScreen` (M2-10) reuses `TopBar` unchanged. The transition is not verifiable in jsdom (the heart transition is deliberately not tested in the browser, see §8.7).
- **`<ResultModal status onRetry>`**: renders nothing unless `status` is `won` or `lost`. `div role="dialog" aria-modal="true" aria-labelledby`, heading "You solved it" / "Out of hearts", one **Retry** button (autofocused) calling `restart`. Plain `div`, not `<dialog>`: jsdom does not implement `showModal`, and the board is already inert via `disabled`. Win has no "next" button until level select exists.
- **`<GameScreen level>`**: on mount `startLevel(level)` in an effect (idempotent, so StrictMode's double-invoke is harmless); selects `status`, `board`, `hearts`; renders `TopBar`, `Board`, `ResultModal`. Renders nothing board-related while `idle`.

**Landed in M2-10 (#49):** `src/ui/screens/ResultModal.tsx`, `src/ui/screens/GameScreen.tsx`, and `App` is now just `<main><GameScreen level={demoLevel} /></main>`.

- `ResultModal`: Retry is focused by a `useEffect` + ref when the dialog opens (not the `autoFocus` attribute, which Biome's `noAutofocus` flags). There is no Escape handler, since Retry is the only exit. A `Tab` keydown on Retry is `preventDefault`ed so focus cannot leave the dialog.
- `GameScreen`: selects `status`, `board`, `hearts` and `wrong` (`"wrong" in s ? s.wrong : undefined`) with narrow selectors, and takes actions once from `gameStore.getState()` so cell callbacks stay stable. The start effect calls `startLevel(level)` and its cleanup resets the singleton to `idleState`, so a later mount never sees an earlier mount's board or result (StrictMode's mount/cleanup/mount ends playing). One guard remains: on the first render of a new `level` prop the store still holds the previous level's board, so `conflicts` (a `useMemo`) and the render both require `storeLevel === level`. The board sits in a wrapper with `inert` while status is not `playing`, in addition to `disabled`; jsdom only proves the attribute; the M2-11 e2e checks the behaviour in a real browser with `disabled` stripped (§7). It renders `null` while `idle` or while the store holds another level (the first render before the start effect).
- The page `h1` is owned by `TopBar` (level id); the old "Doku" title was dropped.
- After Retry, focus falls to `body` because the focused button unmounts; accepted for M2, like the locked-cell focus loss in M2-08 (restoring focus is milestone 4).
- The Playwright playthrough landed in M2-11 (§7).

## 6. Dependencies and tooling

| Add | Why |
|---|---|
| `zustand` | store (decided, `DESIGN.md` §2) |
| `tailwindcss`, `@tailwindcss/vite` | styling (decided, §13.4); Tailwind v4, CSS-first config, plugin registered in `vite.config.ts` |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` | component tests |
| `@playwright/test` | e2e playthrough |

Vitest keeps the engine fast and Tauri-free by splitting into two projects:

- `node`: `src/**/*.test.ts`: no DOM.
- `dom` (jsdom, jest-dom setup file): `src/**/*.test.tsx`.

`bun run test` runs both. Playwright runs via a separate `bun run test:e2e` against the Vite dev server on port 1420 (`webServer` in `playwright.config.ts`, `reuseExistingServer`). It is **not** part of `bun run check`, since it needs browser binaries; CI gets its own job.

Implemented in M2-01 with these deviations from the sketch above: the projects live in a separate `vitest.config.ts` that `mergeConfig`s `vite.config.ts` (now a plain object, not a callback, so it can be merged), keeping the Tauri config clean; `reuseExistingServer` is `!process.env.CI`, so CI always starts its own server while a local `bun tauri dev` is reused; Chromium only; e2e specs live in `e2e/`; `@types/node` is a dev dependency for `process` in the config files. `src/test/harness.test.tsx` was a throwaway proof of the dom project and was deleted in M2-02, when `src/App.test.tsx` became the first real component test.

## 7. Test plan (strict TDD: each row is written failing first)

Fixtures: `uniqueLevel7` for most store/UI tests (solution `[1,3,5,0,2,4,6]`). Helper `wrongCellFor(level)` returns any cell not in the solution; `solutionCells(level)` returns the flat indices.

**Store, node (`game.test.ts`)**

- `startLevel`: status `playing`, 3 hearts, empty board of N² cells, level retained.
- `toggleMark`: Empty → Mark → Empty; hearts and `wrong` unchanged; a ✕ on a solution cell is allowed.
- `placeFace` on an empty solution cell → face; hearts unchanged; `wrong` unchanged.
- `placeFace` on a player ✕ over a solution cell → face (✕ replaced).
- `placeFace` on a non-solution cell (empty or player ✕) → `Cell.Mark`, cell added to `wrong`, hearts − 1.
- Both actions on a face or a wrong ✕ → same state reference; no second heart lost; the wrong ✕ cannot be toggled off.
- Three wrong faces on distinct cells → `lost`, hearts 0; further actions return the same state reference.
- All N solution cells placed → `won`; board is exactly `isSolved`.
- Last correct face placement that wins leaves hearts as they were; a win with 1 heart left is `won`, not `lost`.
- `restart` after `won` and after `lost` → fresh `playing` state, 3 hearts.
- Out-of-range / non-integer index → `RangeError`, state unchanged.
- Input state is never mutated (reuse the engine's frozen-input approach: `Object.freeze` the previous state and board, assert the previous board still equals its snapshot).
- Store binding (`createGameStore`): actions update state; two stores don't share state.

**Selectors, node:** `conflictCells` flattens a hand-built board with an adjacent pair and a row conflict into the expected index set; empty for any board reachable through `toggleMark`/`placeFace`.

**Geometry, node:** on `uniqueLevel7`, thick edges appear exactly where regions differ (assert a few known cells plus a property test: `thickRight(i)` ⇔ regions differ from `i+1`, last column never thick on the right).

**Components, jsdom**

- `CellView`: renders empty/face/wrong with the right label (wrong shows the red ✕); single click calls `onToggleMark(index)`, a `HOLD_TOTAL_MS` press calls `onPlaceFace(index)` once (fake timers), with no glow before `HOLD_DELAY_MS` and no placement at `HOLD_MS`; early release, leave, cancel and blur do not; double-click toggles twice; `x` on a focused cell calls `onToggleMark(index)` and a held `Space` calls `onPlaceFace(index)` without a click; `disabled` blocks both, and face and wrong cells are disabled while the player's ✕ is not; `isConflict` adds the ring; re-render with identical props does not re-render (spy via a render counter in a wrapper).
- `Board`: N rows × N gridcells; labels carry row, column, region name; region-border classes appear where `geometry` says; tapping one cell re-renders only that `CellView`.
- `Hearts`: `aria-label` for 3/2/0 remaining; correct number of filled icons.
- `ResultModal`: nothing for `playing`; correct heading for `won`/`lost`; Retry autofocused and calls `onRetry`.
- `GameScreen` (real store): holding each solution cell shows the win dialog; three wrong holds show the lose dialog, with a red ✕ on each wrong cell; a single click adds a ✕ and a second single click removes it; focusing a solution cell and holding `Space` places a face, `x` toggles a ✕; Retry returns to a fresh board with 3 hearts.

**E2E, Playwright (`e2e/playthrough.spec.ts`)** against `demo-7.json`, locating cells by `aria-label` and reading the solution from the JSON via `fs`/`JSON.parse`:

1. Win: focus each of the 7 solution cells and hold `Space` (plus a mouse hold on one cell to cover the mouse gesture) → "You solved it" → Retry → fresh board.
2. Lose: focus three different non-solution cells and hold `Space` (one heart each) → "Out of hearts" → Retry.

**Landed in M2-11 (#50):** `e2e/playthrough.spec.ts` has three tests. Win (double-click on the row-0 solution cell, Space on the other six) and lose (wrong cell per rows 0-2 at `(solution[r]+1) % size`, each with a red ✕ svg and the hearts label stepping 2, 1, 0) both end with Retry yielding `size*size` empty cells and `3 of 3 hearts`. The inert test removes `disabled` from every cell via `page.evaluate` (cells are otherwise disabled and would mask a missing `inert`), asserts the cell's wrapper has `inert === true`, then asserts that `focus()`, Tab and Shift+Tab leave focus on Retry. Verified by mutation: replacing `inert={finished}` with a plain `div` fails the property assertion and, with that assertion removed, fails the `toBeFocused` assertion on Retry. Not verified in e2e: that Space `keyup` is `preventDefault`ed to stop a synthesized click (an earlier e2e test for it passed with the guard deleted, so it was removed; since #55 `keyup` also cancels the hold, which is covered by "releasing Space early places nothing"). Hearts stay in the accessibility tree behind the modal, so the inert test locates them by role like the other tests. Cells are located by the prefix `^Row r, column c,` because the state suffix changes. The heart transition is not tested (§8.7).

**Landed in #55:** `playthrough.spec.ts` places faces by holding (mouse down, assert the cell commits, mouse up; Space down/assert/up) and adds tests for a short click, double-click (toggles twice, places nothing), early mouse release, drag-off cancel, glow lifecycle and early Space release. They assert state, using fixed sleeps only to show that nothing happened (`HOLD_TOTAL_MS` plus margin). Verified by mutation: removing `onPointerLeave` fails the drag-off test. Removing the click-swallow is not caught by e2e, because a committed cell is `disabled` and never receives the trailing click; it is covered by the `Cell` unit test "a completed hold swallows its trailing click", which fails without it. Touch behaviour (capture release, callout, selection) is unverified off-device. The glow test ("the glow traces a visible border mid-hold") asserts no glow at 100 ms, then samples the rect's computed `stroke-dashoffset` at 30% and 60% of `HOLD_MS` after the delay (it must decrease), checks the stroke width, and counts near-black pixels in a band just inside the cell edge in a screenshot (also saved to `test-results/hold-glow.png`). Result in Chromium: a partial dark border is painted mid-hold and the offset advances. The suspicion that `vector-effect: non-scaling-stroke` breaks `pathLength` normalisation was not reproduced in Chromium (the test also passes with it restored), but it is removed anyway because behaviour there is engine-dependent; the stroke is now `stroke-width: 6` in viewBox units (about 3px on a 50px cell). WebKit is unverified.

## 8. Decisions

1. **Pure transitions + thin Zustand wrapper** over logic written inside `create()`. The state machine is a function table that tests call directly; the store adds only subscription.
2. **`GameState` is a discriminated union** (idle has no level/board), so UI code narrows once.
3. **Single-owner region edges** (right/bottom + frame), drawn as a centered overlay rather than cell borders, so thick lines straddle the thin grid line.
4. **Button inside gridcell**, rather than `role="gridcell"` on a button, to keep native button semantics. `DESIGN.md` §7 is updated accordingly.
5. **Plain `div role="dialog"`** over `<dialog>` for jsdom compatibility.
6. **Demo level as JSON in `src/levels`**, not imported from engine fixtures.
7. **Heart transition is not verified in a browser in M2.** jsdom and Playwright cannot cheaply assert a CSS animation; e2e asserts hearts by role/label only. Revisit if it regresses.
8. **Hold to place a face (#55).** Double-tap is awkward on touch and double-click was easy to trigger by accident. A hold (mouse, touch or Space) places a face: 250 ms of nothing, then a 500 ms glow, so a normal click never shows the animation; a tap or click still toggles ✕. A glow traces the cell border once so the player sees the commit coming, and releasing, leaving, cancelling or blurring early does nothing. Enter does not hold. Leaving the cell cancels with no slack (tune after playtest). `HOLD_MS` is exported and imported by specs, so tests never hardcode timings.

## 9. Open questions

1. **Conflict highlighting is dormant.** Since wrong faces are never placed, `findConflicts` can't fire in M2. Keep the wiring (cheap, issue asks for it), or drop `isConflict` until a feature can produce conflicts? Default: keep, as described in §3.4.
2. **Resolved (PR review):** wrong taps are tracked and shown as locked red ✕s; faces and wrong ✕s are uneditable. Input is then revised (follow-up): single tap toggles the player's own ✕, double-tap places a face, so a stray tap on a ✕ removes it instead of committing anything.
3. **Should e2e run in CI on every push?** Resolved (PR review): yes, as a separate job from `check`.
