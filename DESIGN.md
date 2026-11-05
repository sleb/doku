# Doku — Component-Level Design (draft 2)

A Tauri 2 puzzle game based on a generic region-placement logic puzzle (the same family as Queens-style games). Desktop first; mobile (iOS/Android via Tauri 2 mobile) second. The full app (milestones 1 to 4: engine, board, mobile, campaign with persistence) and the level generator with difficulty tiers (milestone 5) are implemented; iOS runs on the simulator; Android is pending (#64). Milestone 6 (polish) is not started.

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
│  commands: none                                                            │
│  plugins: opener, store; desktop: window-state; mobile: haptics            │
└───────────────▲────────────────────────────────────────────────────────────┘
                │ plugin calls — thin, async, never on the hot path
┌───────────────┴──────────── Frontend (TypeScript + React) ─────────────────┐
│  UI components  →  Game store (state machine)  →  Engine (pure TS)         │
│                                    │                  └ Worker: generator* │
│                                    └→ Storage adapter → plugin-store       │
└────────────────────────────────────────────────────────────────────────────┘
```

\* The Worker is designed for, not built: v1 generates offline in `tools/` and bundles the packs (§10); the engine has no worker-specific code, so on-device generation (milestone 6) can add it.

**Key decision: game logic lives in pure TypeScript, not Rust.** Validation, solving, hints and generation are small, need instant feedback, and must behave identically on desktop and mobile. Rust stays a thin shell for storage and native features. This avoids IPC latency on every tap and keeps the engine unit-testable with no Tauri runtime (and runnable in a browser for fast dev). Revisit only if generation proves too slow in a Worker.

Stack: Tauri 2, Vite, React, TypeScript, Zustand (store), Tailwind CSS, Vitest, Playwright (against the Vite dev server).

## 3. Repository layout

```
doku/
├─ src-tauri/            # Rust shell, capabilities (default/desktop/mobile), gen/apple (gen/android pending #64)
├─ src/
│  ├─ engine/            # pure TS, zero UI/Tauri imports
│  ├─ store/             # game state machine, progress, settings, save format, selectors
│  ├─ platform/          # adapters: storage, haptics (+ pure outcomeFor)
│  ├─ ui/
│  │  ├─ board/          # Board, Cell, hold gesture, geometry, palette
│  │  ├─ hud/            # TopBar, Timer, Hearts
│  │  ├─ screens/        # GameScreen, GameLayout, ActionBar, dialogs, Finale, hooks
│  │  └─ Dialog.tsx      # shared modal primitive
│  ├─ levels/            # campaign.ts (ordered LEVELS) + pack-*.json
│  └─ app/               # boot, autosave, campaign flow, index.css (theme tokens)
├─ e2e/                  # Playwright specs
└─ tools/                # offline level scripts (generate-levels.ts, pack.ts, curriculum.ts; see `docs/GENERATOR_DESIGN.md` §8)
```

Every engine module in §4 exists (`hints.ts` is ladder-driven since M5-06; see `docs/APP_DESIGN.md` §4.4).

## 4. Engine (`src/engine`) — pure, no side effects

Low-level design (data structures, algorithms, tests): `docs/ENGINE_DESIGN.md`.

| Module | Responsibility |
|---|---|
| `types.ts` | `Level { id, size, regions: number[][], solution: number[], tier?, seed? }` (`solution[r]` is the column of the face in row r; `tier` is the `Tier` `rate` assigns and `seed` the generator seed that reproduces the level, both set on generated levels), `Cell = empty \| mark \| face`, `Board`, `Coord` |
| `rules.ts` | `findConflicts(board, level)` → list of `{ reason, cells }` conflicts (`region`/`row`/`col`/`adjacent`); `isSolved(board, level)` → true iff the board holds exactly the solution's N faces; `judgeTap(level, cell)` (flat row-major `cell`; `RangeError` if out of range) → `correct`/`wrong` (the heart-cost rule below) |
| `solver.ts` | Constraint-propagation solver; `solve(level)` and `countSolutions(level, limit=2)` share one backtracker over a `Level` (ignores `level.solution`); `countSolutions` is the uniqueness check |
| `hints.ts` | `nextHint(board, level)` → `{ deduction, message }` (`Hint`): the simplest ladder deduction the player has not yet acted on (a placement, or an elimination with at least one cell not already marked), with a message rendered from a per-technique template in `hintText.ts`. `null` when the board is complete or the ladder is stuck (M5-06; it was a first-open-row stub from M4-04) |
| `generator.ts` | `generate({ size, seed, tier?, shape?, maxAttempts?, shouldStop? })` → `Level \| null`. Each attempt (`tryCandidate`): `randomSolution`, `growRegions` around it, `repairUniqueness` (moves rival cells until `countSolutions == 1`), `passesShape` (`ShapeLimits`), and, when `tier` is given, a `rate` filter that keeps only that tier. Deterministic from `seed`; details in `docs/GENERATOR_DESIGN.md` §5 |
| `techniques.ts` | The ordered technique ladder; each technique is a pure function `(puzzle, candidates) → Deduction \| null` (the first forced face or set of eliminated cells it finds). Easy and Medium landed in M5-04 (`single-candidate`, `region-in-line`, `line-in-region`) and Hard in M5-06 (`adjacency-pressure`, `subset-regions-lines`, `subset-lines-regions`); Expert (`lookahead`, depth 1) landed in M5-07. Shared by the hint system and difficulty rating |
| `difficulty.ts` | `rate(level)` → tier: solve with techniques only, simplest first; the tier is the hardest technique the solve needs. Returns `unrated` if techniques alone cannot finish |
| `seed.ts` | `makeRng(seed)` / `Rng` (`next`, `int`, `shuffle`, `pick`): mulberry32 seeded by `hashSeed` (FNV-1a + fmix32), so generation is reproducible across devices (and a daily puzzle could be, later) |

Design notes:
- **Wrong tap = deviation from the unique solution.** Placing a face on a cell that is not in `level.solution` costs a heart. The wrong face is not placed; the cell is auto-marked ✕ instead, so the player is never stuck in a dead-end board and a mistake is never silently carried forward. Rule conflicts (`findConflicts`, faces only; marks never conflict) are still used for optional highlighting, but cost nothing by themselves. Because correctness depends on the stored solution, the generator must guarantee uniqueness (`countSolutions == 1`) and the loader should verify `solution` against `rules.ts` in dev/test builds.
- Every function takes a board and returns new data. This makes undo/redo and tests trivial.

### 4.1 Difficulty tiers

A puzzle's tier is the hardest technique a human-style solve needs (`difficulty.ts`):

| Tier | Techniques required |
|---|---|
| Easy | Region with one candidate cell left; row/column with one candidate cell left; eliminate cells in the row, column and neighbors of a placed face |
| Medium | A region confined to one row or column eliminates the rest of that line (and the reverse: a row/column confined to one region) |
| Hard | Adjacency pressure: a cell is impossible if placing a face there would leave some region, row or column with no candidates. M regions confined to the same M rows or columns (pairs, triples) eliminate everything else in those lines, and the converse (M lines confined to M regions) |
| Expert | Needs lookahead: assume a cell and propagate with the Easy to Hard techniques to a contradiction (depth 1, no nesting) |

The ladder has seven rungs (`docs/ENGINE_DESIGN.md` §6): rungs 1 to 6 give Easy to Hard and `lookahead` is rung 7. `rate` returns `unrated` only for a level the ladder cannot finish, which the generator always rejects (none occurred in the `--stats` runs). `generate` honours `tier` for every tier. The shipped size and tier cells are in §10; Easy 11x11 is dropped (`docs/GENERATOR_DESIGN.md` §16, §17).

Rules of the system:
- The solver applies the simplest technique that makes progress each step, so the rating is the minimum hardest technique, not whatever a particular path happened to use.
- The generator is asked for a size (7–11) and a tier (Easy–Expert) and keeps a puzzle only if `rate(level)` matches the tier and `countSolutions == 1`. A combination it cannot fill reliably (Easy 11×11) is left out of the curriculum. There is no level select in v1 (§13), so players do not choose a tier; the campaign ramps through them.
- Techniques are also the hint vocabulary, so hint text ("This region only fits in row 4") needs no separate content.
- Tier definitions are v1 starting points; adjust the ladder after playtesting.

## 5. State management (`src/store`)

Milestone 2 low-level design (store, board UI, HUD, tests): `docs/BOARD_DESIGN.md`. Milestone 4 additions (clock, undo/redo, hints, progress, settings): `docs/APP_DESIGN.md`.

A single game store modelled as an explicit state machine, with pure transitions in `game.ts` and a thin Zustand binding in `gameStore.ts`:

```
idle → playing ⇄ paused → won | lost
```

State (when not idle): `level`, `board`, `wrong` (cells the player got wrong, locked), `hearts`, `hintsUsed`, `elapsedMs`, `history[]` / `future[]` (undo/redo stacks of ✕ toggles), `status`. `conflicts` is derived (`selectors.ts`), not stored.

Actions: `startLevel`, `toggleMark` (single tap or `x`: add or remove a ✕ note, free), `placeFace` (press-and-hold or hold `Space`: correct → face, wrong → lost heart and a locked red ✕; faces and wrong ✕s are uneditable), `undo`/`redo` (notes only), `hint` (a correct face in the first open row for one heart; refused on the last heart), `tick` (clock, driven by `useClock`), `pause`/`resume`, `restart`.

Secondary stores: `progressStore` (`next`, `bestMs`) and `settingsStore` (`haptics`, `sound`, `theme`, `palette`, `patterns`, `inputMode`, `seenTutorial`; `inputMode` is consumed by the board (POLISH_DESIGN §9.1); the other new fields are stored but not yet consumed). A `dailyStore` is not built (stars and the daily puzzle are dropped from the app design).

## 6. Persistence (`src/platform/storage.ts`)

Interface `Storage { get, set, remove, flush }` with three adapters: `TauriStorage` (`@tauri-apps/plugin-store`, one JSON file `doku.json` in the app data dir), `LocalStorageStorage` (web/dev/Playwright, keys prefixed `doku:`) and `MemoryStorage` (tests, and the fallback if `localStorage` is unusable). Keys: `settings`, `progress`, `save`. The in-progress game is autosaved (debounced 250 ms, and flushed immediately on `visibilitychange → hidden` and `pagehide`) so the app can be killed on mobile without loss, and restores `paused`. Until the first MVP release the saved schema is unversioned and may change freely (no migrations; loaders validate and discard what does not fit). Add schema versioning and migrations before that release ships. Details: `docs/APP_DESIGN.md` §5.

## 7. UI component tree

```
<App>                           finished && idle ? <Finale/> : <GameScreen/>   (no router)
 ├─ <GameScreen>
 │   ├─ <GameLayout>  slots: header / board / controls (container queries, below)
 │   │    ├─ header   → <TopBar>  "Level n of N" · <Timer/> · <Hearts/> · Pause button
 │   │    ├─ board    → <Board>
 │   │    │    └─ <Cell> → <FaceIcon/> | <MarkIcon/> | conflict ring
 │   │    └─ controls → <ActionBar>  Undo · Redo · Hint
 │   ├─ <PauseDialog>   Resume · Restart level · Rules · Settings
 │   ├─ <RulesDialog/>  <SettingsDialog/>
 │   └─ <ResultModal>   (win: time/best/hints → Next level or Finish · lose: Retry)
 └─ <Finale>            (all levels done: total of best times · Start over)
```

There is no home screen, level select, daily card, how-to-play screen or router. A single `<Dialog>` primitive backs the pause, rules, settings and result dialogs. The first-run interactive tutorial (milestone 6, POLISH_DESIGN §7) replaces the game screen until it is skipped or finished, and is replayed from Pause.

### Component notes

- **`<Board>`**: owns layout only. CSS grid whose `--cell` is derived from the board area's own container size (`cqw`/`cqh`, capped at 4.5rem), not the viewport, so it resizes on desktop and fits phones in both orientations (`docs/BOARD_DESIGN.md` §4.2, `docs/MOBILE_DESIGN.md` §4). Renders region colors from `level.regions`, draws thicker borders where adjacent cells belong to different regions. Role `grid`, cells `gridcell`, each containing a button with `aria-label` ("Row 3, column 5, emerald region, face").
- **`<Cell>`**: pure presentational, memoized; receives `{ region, state, isConflict }` and callbacks. Never reads the store directly, so the board stays fast at N≈12.
- **`<Hearts>`**: 3 hearts, animates loss. Zero hearts triggers `lost`.
- **Hint button** (in `<ActionBar>`): asks for the next ladder deduction and costs one heart; disabled on the last heart. A placement hint puts the face down; an elimination hint highlights the forcing cells (dashed outline) and the cells it rules out (solid outline and tint) and shows the explanation in `<HintBanner>`, writing no marks. Asking again for the hint already on display is free; any move clears it.
- **`<ResultModal>`**: driven by `status`; a win shows time, best and hints used.
- **Theming**: region palette is a token set with a color-blind-safe variant, plus a pattern/number overlay option, since regions are distinguished by color alone otherwise.

## 8. Platform adapter layer (`src/platform`)

Hides differences so UI code stays platform-agnostic:

| Adapter | Desktop | Mobile (phase 2) |
|---|---|---|
| `storage` | `TauriStorage` (tauri-plugin-store) | same |
| `input` | click = toggle ✕, hold (250 ms delay + 500 ms glow) = place face; keyboard: arrows/Home/End move focus, `x` = toggle ✕, hold `Space` = place face, `z` undo, `Shift+Z` or `Ctrl+Y` redo, `h` hint, `Esc` pause. No right-click or click-drag marking (dropped from the design) | same as desktop: tap = toggle ✕, hold = place face (no tool toggle; click-only placement is #57) |
| `haptics` | no-op | `src/platform/haptics` adapter (no-op unless running under Tauri) plays `place`/`wrong`/`win`/`lose`, derived by the pure `outcomeFor` (`src/platform/outcome.ts`) and wired by the `useFeedback` hook in `GameScreen`; the plugin is registered on mobile only and the adapter is gated on Tauri and a mobile user agent (iOS #63 landed, Android #64 pending), see §9 |
| `sound` | `src/platform/sound.ts` + pure `cues.ts`: synthesized WebAudio cues for `place`/`wrong`/`win`/`lose` from `outcomeFor`, wired by `useFeedback` (gated by `settings.sound`, unlocked on the first gesture, suspended when hidden) | same (silent switch behaviour to be verified on device, see `docs/POLISH_DESIGN.md` §5.2) |
| `window` | default 800x600, min size 420x560, remembered size/position (`tauri-plugin-window-state`, desktop only) | safe-area insets via CSS `env()` (`--safe-*` tokens, `viewport-fit=cover`); orientation is not locked |

Responsive layout (landed, M3-01): `GameLayout` is a single layout driven by container queries on `main`. Tall (default) stacks header, board, controls; at container aspect ratio >= 1.2 and width >= 36rem the header and controls move to a side column next to the board. Landscape phones and desktop windows share the wide template; there is no separate desktop path.

## 9. Rust shell (`src-tauri`)

Intentionally small: plugins, window config, capability files. The shell registers the opener and store plugins everywhere (`capabilities/default.json`: `core:default`, `opener:default`, `store:default`), the mobile-only haptics plugin (`capabilities/mobile.json`) and the desktop-only window-state plugin (`capabilities/desktop.json`, `window-state:default`); there is no `fs` plugin and the scaffold's `greet` command is gone. Only add custom `#[tauri::command]`s when a native need appears.

Mobile (see `docs/MOBILE_DESIGN.md` §7): `tauri-plugin-haptics` in `Cargo.toml` (mobile targets only) registered behind `#[cfg(mobile)]`; `capabilities/mobile.json` granting the impact and notification feedback permissions on android/iOS; committed `src-tauri/gen/apple` (#63, landed) and `gen/android` (#64, pending) with build outputs in `src-tauri/.gitignore`; `greet` removed. The JS side (`@tauri-apps/plugin-haptics`) is already installed and loaded lazily by the adapter.

## 10. Content pipeline

- Today: `src/levels/pack-1.json` holds 109 tiered generated levels, in tier order and each satisfying `rate(level) === level.tier`: Easy 7 to 10 (8 each, 32), Medium 7 to 10 (8 each) and 11 (5, 37), Hard 7 to 11 (5 each, 25) and Expert 7 to 11 (3 each, 15). It is written by `bun tools/generate-levels.ts --pack 1` from the ordered list in `tools/curriculum.ts`. The output is byte-reproducible, de-duplicated up to rotation, reflection and region renaming, and re-verified (valid, exactly one solution, `solve` equals the stored solution). `src/levels/campaign.ts` loads every `pack-*.json` into `LEVELS`, ordered by numeric suffix (`orderPackKeys`, so `pack-2` precedes `pack-10`).
- Milestone 5 is done; how it was built, and the measurements behind the curriculum, are in `docs/GENERATOR_DESIGN.md` §14 to §18.
- Levels are bundled with the app (offline-first). *Proposed:* seeded daily puzzle generated on-device from the date, so no server is needed.

## 11. Testing

- **Engine**: unit and property tests (generated levels have exactly one solution; hint always leads to a legal move; solver agrees with `rules`).
- **Engine immutability**: engine functions never mutate their inputs (tested with frozen inputs), so undo/redo can use plain board snapshots.
- **Store**: state-machine transition tests.
- **UI**: jsdom component tests (React Testing Library), Playwright e2e (desktop Chromium plus mobile Chromium and WebKit projects) for playthrough, resume, campaign, keyboard, layout.
- **Manual** (not automatable): device passes per milestone. The M4 items still outstanding (window-state, Tauri store file, iOS kill-and-relaunch) are listed in `docs/APP_DESIGN.md` §9.

## 12. Milestones

1. **Engine + tests** (done) (rules, solver, a few fixture levels for tests: unique 7x7 and 11x11, multi-solution, no-solution; see `docs/ENGINE_DESIGN.md` §11).
2. **Playable desktop board** (Board/Cell, store, hearts, win/lose) (done).
3. **Mobile**: touch input, responsive layout, safe areas, haptics, iOS then Android builds (done for iOS; Android #64 pending).
4. **Full app** (done: play through a fixed series of levels with no level select; persistence, undo/redo, hints, settings, keyboard, desktop window; low-level design in `docs/APP_DESIGN.md`; manual desktop/iOS persistence and window-state checks outstanding).
5. **Generator + level packs + difficulty tiers** (done: 109-level tiered campaign; low-level design and as-built notes in `docs/GENERATOR_DESIGN.md`).
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
10. **Haptics through `src/platform/haptics` with a no-op default** and a pure `outcomeFor`, so the store stays side-effect free (landed). Haptics only for outcomes (place, wrong, win, lose), never for the free ✕.
11. **Commit `src-tauri/gen`**, ignoring build outputs (`gen/apple` committed in #63; `gen/android` pending #64).
12. **iOS first, then Android** (decided; iOS builds on the simulator, #63; Android pending, #64).
13. **No level select, home screen, daily puzzle or stars** in the app: levels play in a fixed order and the app opens on the current one. Progress is one integer plus best times (`next`, `bestMs`).
14. **Undo/redo covers ✕ notes only**; faces and wrong taps are locked, so hearts are never refunded.
15. **Hearts, wrong cells and elapsed time are persisted** and a restored game comes back paused. Saves are unversioned and validated or discarded (pre-MVP).
16. **A hint costs one heart** and is refused on the last one. Since M5-06 it explains the simplest deduction the player has not acted on; an elimination hint highlights and explains but writes no marks, and re-asking for the hint on display is free.
17. **No right-click or drag-to-paint marks**: click and hold are the only pointer gestures.
18. **One screen and one shared `<Dialog>`** for pause, rules, settings and results; the store is pure and time is injected by `useClock`.

19. **Which size/tier combinations ship (milestone 5):** Easy 7 to 10, Medium 7 to 11, Hard 7 to 11, Expert 7 to 11 (counts in §10). Easy 11x11 is dropped for v1: only 16 of 20 `--stats` seeds fill within the attempt budget, below the 18 of 20 criterion, and a level takes about 30 s. Expert ships three levels per size, a cost choice (about 6.4 s per 11x11 level), not a limit. Expert is depth-1 lookahead (no nesting; it solved every level the other rungs left unrated). Steering the generator toward a tier (`docs/GENERATOR_DESIGN.md` §7.3) is not built because nothing needed it.

Still open:
- Daily puzzle and on-device generation (milestone 6): would add the Worker in §2 and a date-derived seed.
