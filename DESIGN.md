# Doku — Component-Level Design (draft 2)

A Tauri 2 puzzle game based on a generic region-placement logic puzzle (the same family as Queens-style games). Desktop first; mobile (iOS/Android via Tauri 2 mobile) second. iOS runs on the simulator; Android is pending.

## 1. Game rules

Grid is N×N and divided into N colored regions. Place N smiley faces (one per region, row and column) such that:

1. **Region:** exactly one face per colored region.
2. **Row/column:** exactly one face per row and per column.
3. **Adjacency:** no two faces touch, including diagonally.
4. **Mistakes:** wrong taps cost hearts (lives).

Grid sizes, controls, hints, scoring and modes are our own design; items not yet agreed are marked *(proposed)*.

**Grid sizes:** 7×7 to 11×11, so an 11×11 puzzle has 11 faces. Smaller grids are easier: fewer cells and regions to reason about, and shorter chains of deduction. Difficulty is a separate axis from size; see §4.1.

## 2. Architecture overview

```
┌──────────────────────────── Tauri shell (Rust) ────────────────────────────┐
│  commands: none yet (persistence commands planned)                         │
│  plugins: opener; mobile: haptics (store, fs planned)                      │
└───────────────▲────────────────────────────────────────────────────────────┘
                │ invoke() — thin, async, never on the hot path
┌───────────────┴──────────── Frontend (TypeScript + React) ─────────────────┐
│  UI components  →  Game store (state machine)  →  Engine (pure TS)         │
│                                    │                  └ Worker: generator  │
│                                    └→ Persistence adapter → Tauri commands │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key decision: game logic lives in pure TypeScript, not Rust.** Validation, solving, hints and generation are small, need instant feedback, and must behave identically on desktop and mobile. Rust stays a thin shell for storage and native features. This avoids IPC latency on every tap and keeps the engine unit-testable with no Tauri runtime (and runnable in a browser for fast dev). Revisit only if generation proves too slow in a Worker.

Suggested stack: Tauri 2, Vite, React, TypeScript, Zustand (store), Tailwind CSS, Vitest, Playwright (against the Vite build).

## 3. Repository layout

```
doku/
├─ src-tauri/            # Rust shell, capabilities, mobile targets (gen/apple landed; gen/android pending #64)
├─ src/
│  ├─ engine/            # pure TS, zero UI/Tauri imports
│  ├─ store/             # game state machine + selectors
│  ├─ platform/          # adapters: storage, haptics, input (Tauri vs web)
│  ├─ ui/
│  │  ├─ board/
│  │  ├─ hud/
│  │  ├─ screens/
│  │  └─ common/
│  ├─ levels/            # authored/generated level packs (JSON)
│  └─ app/               # routing, providers, theme
└─ tools/                # offline level generation / verification scripts
```

## 4. Engine (`src/engine`) — pure, no side effects

Low-level design (data structures, algorithms, tests): `docs/ENGINE_DESIGN.md`.

| Module | Responsibility |
|---|---|
| `types.ts` | `Level { id, size, regions: number[][], solution: number[] }` (`solution[r]` is the column of the face in row r), `Cell = empty \| mark \| face`, `Board`, `Coord` |
| `rules.ts` | `findConflicts(board, level)` → list of `{ reason, cells }` conflicts (`region`/`row`/`col`/`adjacent`); `isSolved(board, level)` → true iff the board holds exactly the solution's N faces; `judgeTap(level, cell)` (flat row-major `cell`; `RangeError` if out of range) → `correct`/`wrong` (the heart-cost rule below) |
| `solver.ts` | Constraint-propagation solver; `solve(level)` and `countSolutions(level, limit=2)` share one backtracker over a `Level` (ignores `level.solution`); `countSolutions` is the uniqueness check |
| `hints.ts` | `nextHint(board, level)` → `{ cell, technique, explanation }`; runs the same ladder from `techniques.ts` and reports the simplest applicable technique |
| `generator.ts` | Build a random valid placement, grow regions around it, accept only if `countSolutions == 1`; difficulty scored by deepest technique required |
| `techniques.ts` | The ordered technique ladder; each technique is a pure function `(board, level) → Deduction[]` (forced faces and eliminated cells). Shared by the hint system and difficulty rating |
| `difficulty.ts` | `rate(level)` → tier: solve with techniques only, simplest first; the tier is the hardest technique the solve needs. Returns `unrated` if techniques alone cannot finish |
| `seed.ts` | Seeded PRNG so daily puzzles are deterministic across devices |

Design notes:
- **Wrong tap = deviation from the unique solution.** Placing a face on a cell that is not in `level.solution` costs a heart. The wrong face is not placed; the cell is auto-marked ✕ instead, so the player is never stuck in a dead-end board and a mistake is never silently carried forward. Rule conflicts (`findConflicts`, faces only; marks never conflict) are still used for optional highlighting, but cost nothing by themselves. Because correctness depends on the stored solution, the generator must guarantee uniqueness (`countSolutions == 1`) and the loader should verify `solution` against `rules.ts` in dev/test builds.
- Every function takes a board and returns new data. This makes undo/redo and tests trivial.

### 4.1 Difficulty tiers

A puzzle's tier is the hardest technique a human-style solve needs (`difficulty.ts`):

| Tier | Techniques required |
|---|---|
| Easy | Region with one candidate cell left; row/column with one candidate cell left; eliminate cells in the row, column and neighbors of a placed face |
| Medium | A region confined to one row or column eliminates the rest of that line (and the reverse: a row/column confined to one region) |
| Hard | Adjacency pressure: a cell is impossible if placing a face there would leave some region, row or column with no candidates. N regions confined to the same N rows or columns (pairs, triples) eliminate everything else in those lines |
| Expert | Needs lookahead: assume a cell, derive a contradiction (depth-limited), or chained deductions |

Rules of the system:
- The solver applies the simplest technique that makes progress each step, so the rating is the minimum hardest technique, not whatever a particular path happened to use.
- Players choose a size (7–11) and a tier (Easy–Expert). The generator keeps puzzles only if `rate(level)` matches the requested tier, and `countSolutions == 1`. Combinations it cannot fill reliably (e.g. 7×7 Expert, 11×11 Easy) are hidden in level select.
- Techniques are also the hint vocabulary, so hint text ("This region only fits in row 4") needs no separate content.
- Tier definitions are v1 starting points; adjust the ladder after playtesting.

## 5. State management (`src/store`)

Milestone 2 low-level design (store, board UI, HUD, tests): `docs/BOARD_DESIGN.md`.

A single game store modelled as an explicit state machine:

```
idle → playing ⇄ paused → won | lost
```

State: `level`, `board`, `hearts`, `history[]` (for undo/redo), `elapsedMs`, `hintsUsed`, `conflicts` (derived), `status`.

Actions: `startLevel`, `toggleMark` (single tap or `x`: add or remove a ✕ note, free), `placeFace` (press-and-hold or hold `Space`: correct → face, wrong → lost heart and a locked red ✕; faces and wrong ✕s are uneditable), `undo`, `redo`, `useHint`, `pause/resume`, `restart`, `reset`.

Secondary stores: `progressStore` (completed levels, best times, stars), `settingsStore` (theme, sound, haptics, color-blind palette, input mode), `dailyStore` (*proposed*).

## 6. Persistence (`src/platform/storage`)

Interface `Storage { get, set }` with two adapters: `TauriStore` (tauri-plugin-store, JSON file in app data dir) and `LocalStorage` (web/dev/tests). Autosave the in-progress board on every move so the app can be killed on mobile without loss. Until the first MVP release the saved schema is unversioned and may change freely (no migrations; stale saves can simply be discarded). Add schema versioning and migrations before that release ships.

## 7. UI component tree

```
<App>
 ├─ <ThemeProvider> <SettingsProvider> <PlatformProvider>
 └─ <Router>
     ├─ <HomeScreen>
     │    ├─ <PlayButton/>  <DailyCard/>*  <ContinueCard/>
     ├─ <LevelSelectScreen>
     │    └─ <LevelGrid> → <LevelTile status stars/>
     ├─ <GameScreen>
     │    ├─ <GameLayout>  slots: header / board / controls (M3; container queries, below)
     │    │    ├─ header   → <TopBar>  <BackButton/> <LevelTitle/> <Timer/> <Hearts/> <MenuButton/>
     │    │    ├─ board    → <Board>
     │    │    │    └─ <Cell> → <FaceIcon/> | <MarkIcon/> | <ConflictHighlight/>
     │    │    └─ controls → <ActionBar>  <UndoButton/> <RedoButton/> <HintButton/>  (rendered only when provided; absent until M4)
     │    ├─ <PauseOverlay/>
     │    ├─ <HintToast/>
     │    └─ <ResultModal>  (win: time/stars/next · lose: retry)
     ├─ <HowToPlayScreen>   (interactive mini-board tutorial)
     └─ <SettingsScreen>
```

### Component notes

- **`<Board>`**: owns layout only. CSS grid whose `--cell` is derived from the board area's own container size (`cqw`/`cqh`, capped at 4.5rem), not the viewport, so it resizes on desktop and fits phones in both orientations (`docs/BOARD_DESIGN.md` §4.2, `docs/MOBILE_DESIGN.md` §4). Renders region colors from `level.regions`, draws thicker borders where adjacent cells belong to different regions. Role `grid`, cells `gridcell`, each containing a button with `aria-label` ("Row 3, column 5, emerald region, face").
- **`<Cell>`**: pure presentational, memoized; receives `{ region, state, isConflict }` and callbacks. Never reads the store directly, so the board stays fast at N≈12.
- **`<Hearts>`**: 3 hearts, animates loss. Zero hearts triggers `lost`.
- **`<HintButton>`**: calls `engine.nextHint`, highlights the cell and region and shows the technique text in `<HintToast>`. Costs a star or time penalty *(proposed)*.
- **`<ResultModal>`**: purely driven by `status`.
- **Theming**: region palette is a token set with a color-blind-safe variant, plus a pattern/number overlay option, since regions are distinguished by color alone otherwise.

## 8. Platform adapter layer (`src/platform`)

Hides differences so UI code stays platform-agnostic:

| Adapter | Desktop | Mobile (phase 2) |
|---|---|---|
| `storage` | tauri-plugin-store | same |
| `input` | click = toggle ✕, hold (250 ms delay + 500 ms glow) = place face; right-click = mark; click-drag to paint marks; keyboard on the focused cell: `x` = toggle ✕, hold `Space` = place face (milestone 2); arrows to move and `z` to undo (milestone 4) | same as desktop: tap = toggle ✕, hold = place face (no tool toggle; click-only placement is #57) |
| `haptics` | no-op | `src/platform/haptics` adapter (no-op unless running under Tauri) plays `place`/`wrong`/`win`/`lose`, derived by the pure `feedbackFor` (`src/platform/feedback.ts`) and wired in `GameScreen`; the plugin is registered on mobile only and the adapter is gated on Tauri and a mobile user agent (iOS #63 landed, Android #64 pending), see §9 |
| `audio` | WebAudio | same (respect silent switch) |
| `window` | min size, remembered size | safe-area insets via CSS `env()` (`--safe-*` tokens, `viewport-fit=cover`); orientation is not locked |

Responsive layout (landed, M3-01): `GameLayout` is a single layout driven by container queries on `main`. Tall (default) stacks header, board, controls; at container aspect ratio >= 1.2 and width >= 36rem the header and controls move to a side column next to the board. Landscape phones and desktop windows share the wide template; there is no separate desktop path.

## 9. Rust shell (`src-tauri`)

Intentionally small for v1: plugins (store, fs), window config, capabilities file. Today the shell registers the opener plugin and the mobile-only haptics plugin (`capabilities/default.json`, `capabilities/mobile.json`); the scaffold's `greet` command is gone. Only add custom `#[tauri::command]`s when a native need appears.

Mobile (see `docs/MOBILE_DESIGN.md` §7): `tauri-plugin-haptics` in `Cargo.toml` (mobile targets only) registered behind `#[cfg(mobile)]`; `capabilities/mobile.json` granting the impact and notification feedback permissions on android/iOS; committed `src-tauri/gen/apple` (#63, landed) and `gen/android` (#64, pending) with build outputs in `src-tauri/.gitignore`; `greet` removed. The JS side (`@tauri-apps/plugin-haptics`) is already installed and loaded lazily by the adapter.

## 10. Content pipeline

- `tools/generate-levels.ts` runs the engine generator offline, verifies uniqueness, assigns difficulty, writes `src/levels/pack-*.json`.
- Levels are bundled with the app (offline-first). *Proposed:* seeded daily puzzle generated on-device from the date, so no server is needed.

## 11. Testing

- **Engine**: unit and property tests (generated levels have exactly one solution; hint always leads to a legal move; solver agrees with `rules`).
- **Engine immutability**: engine functions never mutate their inputs (tested with frozen inputs), so undo/redo can use plain board snapshots.
- **Store**: state-machine transition tests.
- **UI**: component tests for Cell/Board, Playwright for a full level playthrough.
- Mobile: manual device pass per milestone.

## 12. Milestones

1. **Engine + tests** (rules, solver, a few fixture levels for tests: unique 7x7 and 11x11, multi-solution, no-solution; see `docs/ENGINE_DESIGN.md` §11).
2. **Playable desktop board** (Board/Cell, store, hearts, win/lose).
3. **Mobile**: touch input, responsive layout, safe areas, haptics, iOS then Android builds.
4. **Full desktop app** (level select, persistence, undo/redo, hints, settings, keyboard).
5. **Generator + level packs + difficulty tiers.**
6. **Polish**: sound, animations, daily puzzle, accessibility pass.

## 13. Decisions and open questions

Decided:
1. **Grid sizes:** 7×7 to 11×11, one face per region, row and column (N faces on an N×N grid). **Levels are generated** for v1; hand-authored levels are a possible future addition (the level JSON format should not preclude them).
2. **Hearts:** 3 per level, no recovery, no ads or monetization. (Avoiding interstitial ads is the reason this app exists.)
3. **Theme:** smiley faces. All branding, names, art and levels are our own; no references to any specific existing game.
4. **Frontend:** React, styled with Tailwind CSS.
5. **Accounts, leaderboards, cloud sync:** not for v1.
6. **Marks (✕):** free notes, never cost a heart, even on a cell that holds a face.
7. **Wrong tap:** deviation from the unique solution (see §4). Dead-end boards are avoided by not placing wrong faces.
8. **Mobile input is unchanged:** tap = ✕, hold (250 ms delay, 500 ms glow) = face. No tool toggle (click-only placement is #57).
9. **One layout via container queries** for phones (both orientations) and desktop; orientation is not locked (landed).
10. **Haptics through `src/platform/haptics` with a no-op default** and a pure `feedbackFor`, so the store stays side-effect free (landed). Haptics only for outcomes (place, wrong, win, lose), never for the free ✕.
11. **Commit `src-tauri/gen`**, ignoring build outputs (`gen/apple` committed in #63; `gen/android` pending #64).
12. **iOS first, then Android** (decided; iOS builds on the simulator, #63; Android pending, #64).

Still open:
1. **Which size/tier combinations to ship:** decide after seeing what the generator can produce reliably.
