# Doku — Component-Level Design (draft 1)

A Tauri 2 puzzle game in the style of Meowdoku (a "Queens"-type logic puzzle). Desktop first, mobile (iOS/Android via Tauri 2 mobile) second.

## 1. Game rules (from meowdoku.org/how-to-play)

Grid is N×N and divided into N colored regions. Place N cats such that:

1. **Region:** exactly one cat per colored region.
2. **Row/column:** exactly one cat per row and per column.
3. **Adjacency:** no two cats touch, including diagonally.
4. **Mistakes:** wrong taps cost hearts (lives).

The source page does not specify grid size, win conditions, controls, hints, scoring or modes. Those are proposals below, marked *(proposed)*.

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

Suggested stack: Tauri 2, Vite, React, TypeScript, Zustand (store), CSS Modules or Tailwind, Vitest, Playwright (against the Vite build).

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
| `types.ts` | `Level { id, size, regions: number[][] }`, `Cell = empty \| mark \| cat`, `Board`, `Coord` |
| `rules.ts` | `findConflicts(board, level)` → set of violating cells + reason (`region`/`row`/`col`/`adjacent`); `isSolved()` |
| `solver.ts` | Constraint-propagation solver; `solve()`, `countSolutions(limit=2)` for uniqueness |
| `hints.ts` | `nextHint(board, level)` → `{ cell, technique, explanation }` using the human-technique ladder (single-cell region, region confined to one row/col, etc.) |
| `generator.ts` | Build a random valid placement, grow regions around it, accept only if `countSolutions == 1`; difficulty scored by deepest technique required |
| `difficulty.ts` | Maps required techniques → tier (Easy/Medium/Hard/Expert) |
| `seed.ts` | Seeded PRNG so daily puzzles are deterministic across devices |

Design notes:
- A placed cat that violates a rule is the "wrong tap" that costs a heart. Decide whether wrongness means **rule conflict** (cheap, local) or **differs from the unique solution** (stricter). Recommend **rule conflict** by default, since it matches the stated rules and is explainable to the player.
- Every function takes a board and returns new data. This makes undo/redo and tests trivial.

## 5. State management (`src/store`)

A single game store modelled as an explicit state machine:

```
idle → playing ⇄ paused → won | lost
```

State: `level`, `board`, `hearts`, `history[]` (for undo/redo), `elapsedMs`, `hintsUsed`, `conflicts` (derived), `status`.

Actions: `startLevel`, `tapCell` (cycles empty → mark → cat, or per input mode), `undo`, `redo`, `useHint`, `pause/resume`, `restart`, `reset`.

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
     │    │    └─ <Cell> → <CatIcon/> | <MarkIcon/> | <ConflictHighlight/>
     │    ├─ <ActionBar>  <UndoButton/> <RedoButton/> <HintButton/> <InputModeToggle/>
     │    ├─ <PauseOverlay/>
     │    ├─ <HintToast/>
     │    └─ <ResultModal>  (win: time/stars/next · lose: retry)
     ├─ <HowToPlayScreen>   (interactive mini-board tutorial)
     └─ <SettingsScreen>
```

### Component notes

- **`<Board>`**: owns layout only. CSS grid sized with `min(vw, vh)`-based `--cell` so it is resizable on desktop and fills width on mobile. Renders region colors from `level.regions`, draws thicker borders where adjacent cells belong to different regions. Role `grid`, cells `gridcell` with `aria-label` ("Row 3, column 5, green region, cat").
- **`<Cell>`**: pure presentational, memoized; receives `{ region, state, isConflict }` and callbacks. Never reads the store directly, so the board stays fast at N≈12.
- **`<Hearts>`**: N hearts, animates loss. Zero hearts triggers `lost`.
- **`<InputModeToggle>`**: tap cycles (empty → ✕ → 🐱) vs. explicit "place cat / place mark" tool. Needed on mobile where right-click/drag are unavailable.
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

1. **Engine + tests** (rules, solver, a few hand-made levels).
2. **Playable desktop board** (Board/Cell, store, hearts, win/lose).
3. **Full desktop app** (level select, persistence, undo/redo, hints, settings, keyboard).
4. **Generator + level packs + difficulty tiers.**
5. **Mobile**: touch input, responsive layout, safe areas, haptics, Android then iOS builds.
6. **Polish**: sound, animations, daily puzzle, accessibility pass.

## 13. Open questions

1. Grid sizes and level count: fixed range (e.g. 5×5 to 10×10)? Hand-authored, generated, or both?
2. Wrong-tap definition: rule conflict vs. mismatch with the solution (see §4)?
3. Hearts: 3 per level? Any recovery or ads/monetization (assume none)?
4. Theme: cats literally (art needed), or a neutral skin to avoid copying Meowdoku's branding? (The mechanics are a generic puzzle type; art, name and levels should be our own.)
5. Frontend framework: React assumed; Svelte or Solid are equally viable if you prefer.
6. Do you want accounts, leaderboards or cloud sync? Assumed no for v1.
