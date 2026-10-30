# Doku — Component-Level Design (draft 2)

A Tauri 2 puzzle game based on a generic region-placement logic puzzle (the same family as Queens-style games). Desktop first, mobile (iOS/Android via Tauri 2 mobile) second.

## 1. Game rules

Grid is N×N and divided into N colored regions. Place k smiley faces in every region, row and column (N·k total) such that, where k = `facesPerLine(N)` (see below):

1. **Region:** exactly k faces per colored region.
2. **Row/column:** exactly k faces per row and per column.
3. **Adjacency:** no two faces touch, including diagonally.
4. **Mistakes:** wrong taps cost hearts (lives).

Grid sizes, controls, hints, scoring and modes are our own design; items not yet agreed are marked *(proposed)*.

**Scaling *(proposed)*:** grid sizes run 10×10 to 20×20, and k grows with N so large boards stay constrained and solvable by deduction (same convention as Star Battle puzzles):

| Grid size N | k (faces per region/row/column) | Total faces |
|---|---|---|
| 10–13 | 2 | 20–26 |
| 14–16 | 3 | 42–48 |
| 17–20 | 4 | 68–80 |

`facesPerLine(N)` is a single function in the engine; `Level` also stores `k` so the rules never hard-code it. Adjacency still forbids touching faces (diagonals included).

## 2. Architecture overview

```
┌──────────────────────────── Tauri shell (Rust) ────────────────────────────┐
│  commands: save_progress / load_progress / settings / (later) haptics      │
│  plugins: store, fs, os; mobile: haptics, share                            │
└───────────────▲────────────────────────────────────────────────────────────┘
                │ invoke() — thin, async, never on the hot path
┌───────────────┴──────────── Frontend (TypeScript + React) ─────────────────┐
│  UI components  →  Game store (state machine)  →  Engine (pure TS)         │
│                                    │                  └ Worker: generator   │
│                                    └→ Persistence adapter → Tauri commands  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key decision: game logic lives in pure TypeScript, not Rust.** Validation, solving, hints and generation are small, need instant feedback, and must behave identically on desktop and mobile. Rust stays a thin shell for storage and native features. This avoids IPC latency on every tap and keeps the engine unit-testable with no Tauri runtime (and runnable in a browser for fast dev). Revisit only if generation proves too slow in a Worker.

Suggested stack: Tauri 2, Vite, React, TypeScript, Zustand (store), Tailwind CSS, Vitest, Playwright (against the Vite build).

## 3. Repository layout

```
doku/
├─ src-tauri/            # Rust shell, capabilities, mobile targets (later)
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

| Module | Responsibility |
|---|---|
| `types.ts` | `Level { id, size, k, regions: number[][] }`, `Cell = empty \| mark \| face`, `Board`, `Coord` |
| `rules.ts` | `findConflicts(board, level)` → set of violating cells + reason (`region`/`row`/`col`/`adjacent`); `isSolved()` |
| `solver.ts` | Constraint-propagation solver; `solve()`, `countSolutions(limit=2)` for uniqueness |
| `hints.ts` | `nextHint(board, level)` → `{ cell, technique, explanation }` using the human-technique ladder (single-cell region, region confined to one row/col, etc.) |
| `generator.ts` | Build a random valid placement, grow regions around it, accept only if `countSolutions == 1`; difficulty scored by deepest technique required |
| `difficulty.ts` | Maps required techniques → tier (Easy/Medium/Hard/Expert) |
| `seed.ts` | Seeded PRNG so daily puzzles are deterministic across devices |

Design notes:
- **Wrong tap = rule violation.** Placing a face that breaks region/row/column/adjacency limits for the current board costs a heart. A placement that is legal now but cannot lead to the unique solution is *not* penalized (it will show up as a violation later, or the player undoes it). `rules.ts` only needs the board, not the solution.
- Every function takes a board and returns new data. This makes undo/redo and tests trivial.

## 5. State management (`src/store`)

A single game store modelled as an explicit state machine:

```
idle → playing ⇄ paused → won | lost
```

State: `level`, `board`, `hearts`, `history[]` (for undo/redo), `elapsedMs`, `hintsUsed`, `conflicts` (derived), `status`.

Actions: `startLevel`, `tapCell` (cycles empty → mark → face, or per input mode), `undo`, `redo`, `useHint`, `pause/resume`, `restart`, `reset`.

Secondary stores: `progressStore` (completed levels, best times, stars), `settingsStore` (theme, sound, haptics, color-blind palette, input mode), `dailyStore` (*proposed*).

## 6. Persistence (`src/platform/storage`)

Interface `Storage { get, set }` with two adapters: `TauriStore` (tauri-plugin-store, JSON file in app data dir) and `LocalStorage` (web/dev/tests). Autosave the in-progress board on every move so the app can be killed on mobile without loss. Version the saved schema from day one.

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
     │    ├─ <TopBar>  <BackButton/> <LevelTitle/> <Timer/> <Hearts/> <MenuButton/>
     │    ├─ <Board>
     │    │    └─ <Cell> → <FaceIcon/> | <MarkIcon/> | <ConflictHighlight/>
     │    ├─ <ActionBar>  <UndoButton/> <RedoButton/> <HintButton/> <InputModeToggle/>
     │    ├─ <PauseOverlay/>
     │    ├─ <HintToast/>
     │    └─ <ResultModal>  (win: time/stars/next · lose: retry)
     ├─ <HowToPlayScreen>   (interactive mini-board tutorial)
     └─ <SettingsScreen>
```

### Component notes

- **`<Board>`**: owns layout only. CSS grid sized with `min(vw, vh)`-based `--cell` so it is resizable on desktop and fills width on mobile. Renders region colors from `level.regions`, draws thicker borders where adjacent cells belong to different regions. Role `grid`, cells `gridcell` with `aria-label` ("Row 3, column 5, green region, face").
- **`<Cell>`**: pure presentational, memoized; receives `{ region, state, isConflict }` and callbacks. Never reads the store directly, so the board stays fast at N≈12.
- **`<Hearts>`**: 3 hearts, animates loss. Zero hearts triggers `lost`.
- **`<InputModeToggle>`**: tap cycles (empty → ✕ → 😀) vs. explicit "place face / place mark" tool. Needed on mobile where right-click/drag are unavailable.
- **`<HintButton>`**: calls `engine.nextHint`, highlights the cell and region and shows the technique text in `<HintToast>`. Costs a star or time penalty *(proposed)*.
- **`<ResultModal>`**: purely driven by `status`.
- **Theming**: region palette is a token set with a color-blind-safe variant, plus a pattern/number overlay option, since regions are distinguished by color alone otherwise.

## 8. Platform adapter layer (`src/platform`)

Hides differences so UI code stays platform-agnostic:

| Adapter | Desktop | Mobile (phase 2) |
|---|---|---|
| `storage` | tauri-plugin-store | same |
| `input` | click = cycle; right-click = mark; click-drag to paint marks; keyboard (arrows + space/x/z) | tap = cycle or per toggle; long-press = mark |
| `haptics` | no-op | vibrate on place/conflict/win |
| `audio` | WebAudio | same (respect silent switch) |
| `window` | min size, remembered size | safe-area insets, orientation lock to portrait |

Responsive plan: a single layout driven by container queries. Desktop shows board plus a side panel (hearts, timer, actions); under ~700px width the panel collapses into top and bottom bars.

## 9. Rust shell (`src-tauri`)

Intentionally small for v1: plugins (store, fs), window config, capabilities file. Mobile: `tauri android init` / `ios init` later, then add haptics and share plugins. Only add custom `#[tauri::command]`s when a native need appears.

## 10. Content pipeline

- `tools/generate-levels.ts` runs the engine generator offline, verifies uniqueness, assigns difficulty, writes `src/levels/pack-*.json`.
- Levels are bundled with the app (offline-first). *Proposed:* seeded daily puzzle generated on-device from the date, so no server is needed.

## 11. Testing

- **Engine**: unit and property tests (generated levels have exactly one solution; hint always leads to a legal move; solver agrees with `rules`).
- **Store**: state-machine transition tests.
- **UI**: component tests for Cell/Board, Playwright for a full level playthrough.
- Mobile: manual device pass per milestone.

## 12. Milestones

1. **Engine + tests** (rules, solver, a few fixture levels for tests).
2. **Playable desktop board** (Board/Cell, store, hearts, win/lose).
3. **Full desktop app** (level select, persistence, undo/redo, hints, settings, keyboard).
4. **Generator + level packs + difficulty tiers.**
5. **Mobile**: touch input, responsive layout, safe areas, haptics, Android then iOS builds.
6. **Polish**: sound, animations, daily puzzle, accessibility pass.

## 13. Decisions and open questions

Decided:
1. **Grid sizes:** variable, 10×10 to 20×20. **Levels are generated** for v1; hand-authored levels are a possible future addition (the level JSON format should not preclude them).
2. **Hearts:** 3 per level, no recovery, no ads or monetization. (Avoiding interstitial ads is the reason this app exists.)
3. **Theme:** smiley faces. All branding, names, art and levels are our own; no references to any specific existing game.
4. **Frontend:** React, styled with Tailwind CSS.
5. **Accounts, leaderboards, cloud sync:** not for v1.
6. **Wrong tap:** rule violation (see §4).

Still open:
1. **Faces per line (k):** the table in §1 is a proposal. Alternative: k = 1 at every size.
2. **Difficulty scaling** across 10–20 and whether smaller starter grids (e.g. a tutorial 5×5) are allowed outside the 10–20 range.
