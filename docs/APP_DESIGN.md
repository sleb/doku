# Doku: Milestone 4 low-level design (full app)

Companion to `DESIGN.md` §5, §6, §7, §8 and §12 for milestone 4 ("Full app"; it was "Full desktop app" before mobile was pulled forward). It turns the single-level game into an app a person can open, play through a series of levels, quit, and come back to. It covers campaign progression, persistence, timer and pause, undo/redo, hints, settings, keyboard play, and the desktop window. The engine, the board and the mobile work (`docs/ENGINE_DESIGN.md`, `docs/BOARD_DESIGN.md`, `docs/MOBILE_DESIGN.md`) are consumed as-is except where stated. Where this document and `DESIGN.md` disagree, this one wins until `DESIGN.md` is synced (§12).

**Status:** design only; nothing here is implemented.

## 1. Goals and non-goals

**Goal:** launching the app drops the player straight into their current level. Winning offers "Next level"; losing offers "Retry". Levels come in a fixed order and there is no level select, no home screen and no menu of levels. Quitting at any moment (including a force-kill on a phone) and relaunching puts the player back where they were, with the same hearts and elapsed time. The same build works on desktop and iOS (Android when #64 lands).

**Non-goals:**
- Level select, home screen, daily puzzle, stars (`DESIGN.md` §7 `LevelSelectScreen`, `HomeScreen`, `DailyCard`, `ContinueCard` are dropped, not deferred).
- A generator, difficulty rating or the technique-explained hint (milestone 5). Levels in this milestone come from a small bundled seed pack (§3).
- Sound, animations, color-blind palette, themes, the interactive tutorial (milestone 6). Android specifics (#64, #70).
- Accounts, cloud sync, leaderboards (`DESIGN.md` decision 5).

## 2. What exists and what changes

| Today | Change |
|---|---|
| `App` renders `GameScreen level={demoLevel}`; `?level=` dev override picks demo-11 | `App` renders the player's current campaign level from stores; `?level=<id>` stays as a dev-only start override (§3.3) |
| `GameScreen` takes a `level` prop, starts it in an effect, resets the store to idle on unmount | `GameScreen` is a view of `gameStore`; a `campaign` module owns starting, advancing and restoring (§3.2, §5.4) |
| `GameState`: `idle \| playing \| won \| lost`, no clock, no history | Adds `paused`, `elapsedMs`, `hintsUsed`, `history`, `future` (§4) |
| `ResultModal`: heading and one button; focus trap hand-rolled | Shared `<Dialog>`; win shows time, best, hints and "Next level" (§7.3) |
| `TopBar`: level id and hearts | Adds "Level n of N", timer (optional), pause button (§7.2) |
| `GameLayout` `controls` slot unused | `<ActionBar>`: Undo, Redo, Hint (§7.2) |
| Every cell is a tab stop; locked cells are `disabled` | Roving tabindex with arrow-key movement; locked cells use `aria-disabled` so they stay reachable (§7.5) |
| No persistence; `src/platform` has only haptics | `Storage` seam with Tauri-store and `localStorage` adapters; autosave and resume (§5) |
| Haptics always on | Gated by a persisted setting (§6) |
| Window is 800×600 with no minimum; no stored size | Minimum size and remembered size on desktop (§8) |

## 3. Levels and progression

### 3.1 Pack format and seed pack

A pack is a JSON file `{ "levels": Level[] }` in `src/levels/` (the format `DESIGN.md` §10 already names, `pack-*.json`). `src/levels/campaign.ts` loads every pack through `loadLevel` (which already rejects malformed levels) and exports the ordered list:

```ts
export const LEVELS: readonly Level[];   // concatenation of packs in filename order
export function levelIndex(id: string): number;   // -1 if unknown
```

Level `id`s are unique across packs (tested). The campaign order is the array order; there is no per-level metadata beyond the engine's `Level`.

**Seed pack (`pack-1.json`), 8 levels, sizes ascending as a stand-in for difficulty** (tiers are unrated until milestone 5): 7, 7, 8, 8, 9, 10, 10, 11. `demo-7` and `demo-11` are folded in (their JSON moves into the pack; `demoLevel.ts` and the standalone files are deleted). The other levels come from a throwaway script `tools/seed-pack.ts` (random valid placement, grow regions, keep if `countSolutions == 1`). It is a deliberately naive precursor of `tools/generate-levels.ts` (milestone 5), which replaces it and rewrites the pack. If naive rejection sampling cannot produce a unique 10×10 or 11×11 in reasonable time, ship fewer large levels rather than grow the script (§11 question 4).

Tests (node): every level passes `validateLevel`, `countSolutions(level) === 1`, size is in 7–11, ids are unique, sizes are non-decreasing (the intended curve), and the pack is non-empty.

### 3.2 Progress

```ts
interface Progress {
  next: number;                       // index into LEVELS of the level to play; === LEVELS.length means finished
  bestMs: Record<string, number>;     // level id -> best winning time
}
```

`src/store/progress.ts` has pure transitions plus a thin Zustand binding, the same split as `game.ts` / `gameStore.ts`:

- `recordWin(p, index, id, elapsedMs)` → `next = max(p.next, index + 1)`, `bestMs[id] = min(existing, elapsedMs)`. Replaying never moves `next` backward and never raises a best.
- `startOver(p)` → `next = 0`, keeps `bestMs`.
- `currentLevel(p)` → `LEVELS[p.next]` or `null` when finished.

`next` is clamped into `[0, LEVELS.length]` on load, so a pack that shrinks between versions cannot strand the player.

### 3.3 Flow

`src/app/campaign.ts` is the only code that starts levels. It owns the wiring between stores; components call its functions.

- `boot(storage)` (§5.4): hydrate settings and progress, then restore a saved game if one matches the current level, otherwise `gameStore.startLevel(currentLevel)`.
- `nextLevel()`: after a win, `gameStore.startLevel(LEVELS[progress.next])`, or idle if finished.
- `retry()`: `gameStore.restart()` (already exists).
- `startOver()`: progress `startOver`, then start level 0.
- A subscription on `gameStore` calls `progress.recordWin` exactly on the transition into `won` (never on restore of an already-won state, which cannot occur: wins are never saved). The win is recorded when it happens, so quitting on the result modal and relaunching starts the next level.

Win on the last level records `next === LEVELS.length`; the result modal's button reads "Finish" and leads to the finale (§7.4). Level numbers shown to the player are `index + 1` of `LEVELS.length`.

**Dev override:** `?level=<id>` (only when `import.meta.env.DEV`) makes `boot` ignore saved game and progress and start that level, without writing progress. This keeps the e2e specs that need the 11×11 board deterministic. Production builds have no override.

## 4. Game state (`src/store/game.ts`)

### 4.1 Shape

```ts
type GameStatus = "idle" | "playing" | "paused" | "won" | "lost";

type Started = {
  status: "playing" | "paused" | "won" | "lost";
  level: Level; board: Board; wrong: ReadonlySet<number>; hearts: number;
  elapsedMs: number;
  hintsUsed: number;
  history: readonly (readonly number[])[];   // undo stack: groups of cells whose mark was flipped
  future: readonly (readonly number[])[];    // redo stack
};
```

`idle` is unchanged. State machine: `idle → playing ⇄ paused → won | lost`; `restart` and `startLevel` go to `playing` from anywhere.

### 4.2 Transitions (all pure, all return new objects; engine immutability rules apply)

| Transition | Behavior |
|---|---|
| `tick(s, dtMs)` | `playing` only: `elapsedMs += dtMs`. Negative or non-finite `dtMs` is ignored. |
| `pause(s)` / `resume(s)` | `playing → paused` / `paused → playing`; anything else is a no-op. While `paused` every board action is a no-op (the existing `editable` guard already requires `playing`). |
| `applyMarks(s, cells, to)` | Sets each editable cell in `cells` to `Mark` or `Empty`; cells already in that state or locked are skipped. If any changed, pushes the changed cells as one group on `history` and clears `future`. `toggleMark(s, cell)` becomes `applyMarks([cell], opposite-of-current)`, so the existing behavior and tests are preserved. One group is one undo step; a drag stroke (§7.5) is one group. |
| `undo(s)` / `redo(s)` | Pop a group from `history` (or `future`), flip each cell in it, push the group on the other stack. No-op on empty stacks or when not `playing`. |
| `placeFace(s, cell)` | Unchanged, plus: whichever way it resolves the cell becomes locked, so `cell` is removed from every group in `history` and `future` (empty groups dropped). This keeps the invariant below. |
| `useHint(s)` | `playing` only. `nextHint(board, level)` (§4.4) returns a cell; the transition commits a correct face there exactly as `placeFace` does (so it can win the level), increments `hintsUsed` and costs one heart. Refused (no-op) when `hearts <= 1`, so a hint can never end the level in a loss. |
| `restart(s)` / `startLevel(l)` | Reset to a fresh board: hearts 3, `elapsedMs` 0, `hintsUsed` 0, empty stacks. |

**Invariant (property-tested):** every cell in `history` and `future` is currently editable (not a face, not wrong). Hence `undo`/`redo` never need a guard against locked cells, and flipping a group is always valid.

**Undo covers notes only.** Faces and wrong ✕s are locked by design (`BOARD_DESIGN.md`, decision 7), and a wrong tap spends a heart that must never come back. Making wrong taps undoable would either refund hearts or leave a heart-less undo that re-opens a cell the player now knows is wrong; neither is worth it. So undo/redo is the tool for ✕ notes, which is where mistakes actually happen. A hint's face is locked like any other face.

### 4.3 Hearts, timer and the lose/win result

`won`/`lost` freeze `elapsedMs`. `restart` after a loss resets the clock. The result modal reads `elapsedMs` and `hintsUsed` from state; nothing else about the result is stored.

### 4.4 Engine addition: `src/engine/hints.ts`

`DESIGN.md` §4 plans `nextHint(board, level) → { cell, technique, explanation }`, built on the technique ladder (milestone 5). This milestone ships the stub with the stable part of that signature:

```ts
export function nextHint(board: Board, level: Level): { cell: number } | null;
```

It returns the solution cell of the first row (top to bottom) that has no face yet, or `null` when every row has one. The result is always correct and always editable (a wrong ✕ can never sit on a solution cell; a player ✕ can, and `placeFace` allows it). Milestone 5 adds `technique` and `explanation` and changes which cell is chosen; callers read only `cell` until then. Tests: pure, no input mutation, returns a cell where `judgeTap === "correct"`, `null` on a complete board, and repeated hints on a growing board terminate in a solved board.

**A hint costs one heart** (decision 2 of `DESIGN.md` §13 holds: 3 hearts, no recovery), so hints are naturally capped at two per level and trade directly against mistakes. The Hint button is disabled on the last heart. The count is recorded and shown on the result. Haptics: `feedbackFor` currently reads a heart drop as `wrong`; it must treat a `hintsUsed` increase as `place` instead (a hint is a deliberate, correct face), with a test.

## 5. Persistence

### 5.1 `Storage` seam (`src/platform/storage.ts`)

```ts
export interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  /** Force pending writes to disk. */
  flush(): Promise<void>;
}
```

Two adapters, chosen once like the haptics adapter (`window.__TAURI_INTERNALS__` present → Tauri):

- `TauriStorage`: `@tauri-apps/plugin-store`, one file `doku.json` in the app data dir, loaded lazily. `set` uses the plugin's debounced autosave; `flush` calls `save()`.
- `LocalStorageStorage`: JSON under a `doku:` key prefix, for the browser dev server, Playwright and tests. Synchronous underneath, wrapped in promises. Any `localStorage` exception (private mode, quota) is swallowed and logged: the game must play without persistence.

Also `MemoryStorage` (a `Map`) for node and component tests; it is also the fallback if both real adapters fail to initialize.

Keys: `settings`, `progress`, `save`. Values are plain JSON. **No schema version and no migrations** until the first MVP release (CLAUDE.md): every loader validates its input and discards anything that does not fit (§5.3), so a changed shape costs a player one reset, not a crash.

### 5.2 Saved game

```ts
interface SavedGame {
  levelId: string;
  board: number[];       // Cell values, row-major
  wrong: number[];
  hearts: number;
  elapsedMs: number;
  hintsUsed: number;
}
```

Not saved: `history`/`future` (undo does not survive a restart) and the status. Hearts and `wrong` are saved so that quitting cannot refund hearts or forget which cells are known wrong.

`toSaved(state): SavedGame | null` (null unless `playing` or `paused`) and `fromSaved(saved, level): Started | null` are pure and live in `src/store/persist.ts`. `fromSaved` returns `null` (saved game discarded) unless: `levelId === level.id`, `board.length === size²`, every board value is a valid `Cell`, every `wrong` index is in range, unique and holds a `Mark`, `hearts` is an integer in `1..MAX_HEARTS`, `elapsedMs` is finite and ≥ 0, `hintsUsed` is an integer ≥ 0, and the board has no `Face` on a cell where `judgeTap` is `wrong` and is not already solved. A restored game comes back **`paused`**, so the clock does not run before the player is looking at it (§7.2 shows "Resume").

### 5.3 Settings and progress persistence

Same pattern: `parseSettings(unknown): Settings` (field-by-field fallback to defaults) and `parseProgress(unknown): Progress` (clamp `next`, drop non-finite `bestMs` entries). Both are total functions: garbage in, defaults out.

### 5.4 Wiring (`src/app/boot.ts`, `src/app/autosave.ts`)

- `main.tsx`: `boot(storage).then(render)`. Nothing renders until boot resolves (tens of ms); no splash screen. A thrown read is logged and treated as "nothing stored".
- **Autosave** is a `gameStore` subscription that fires `storage.set("save", toSaved(state))` when any of `board`, `wrong`, `hearts`, `hintsUsed`, `status` changed (shallow compare, so the 500 ms clock ticks do not write). Writes are coalesced with a 250 ms trailing debounce. `won` and `lost` and `idle` call `storage.remove("save")`. Progress and settings write on change (they change rarely).
- **Flush** on `visibilitychange → hidden` and `pagehide`: write the latest save (now including `elapsedMs`, so a kill loses at most the time since the last background) and `storage.flush()`. On mobile this is the only reliable moment before the OS kills the process; on desktop it also fires on minimize.
- A write that rejects is logged and dropped; the next change retries naturally.

## 6. Settings

```ts
interface Settings { haptics: boolean; showTimer: boolean; seenRules: boolean }
// defaults: { haptics: true, showTimer: true, seenRules: false }
```

`src/store/settings.ts` (pure `parseSettings`, thin Zustand binding with `set(patch)`), persisted on change. Consumers:
- The haptics subscription in `GameScreen` plays a buzz only if `settings.haptics` (resolves `MOBILE_DESIGN.md` §6.3). The desktop adapter is already a no-op.
- `TopBar` shows the timer only if `showTimer`. The clock still runs and the result still shows the time; the setting hides the number during play.
- `seenRules` triggers the rules dialog on first launch (§7.3) and is set when it is dismissed.

Theme, sound and the color-blind palette are milestone 6 and add fields then. The settings dialog also has "Start over" (§7.3) because it is the one destructive action; it asks for confirmation.

## 7. UI

### 7.1 Component tree

`DESIGN.md` §7 is replaced by this (the router goes away; there is one screen):

```
<App>                              reads progress; finished ? <Finale/> : <GameScreen/>
 ├─ <GameScreen>                   view of gameStore; no props
 │   ├─ <GameLayout>
 │   │    ├─ header   → <TopBar>  "Level n of N" · <Timer/>? · <Hearts/> · <PauseButton/>
 │   │    ├─ board    → <Board>   (roving focus, §7.5)
 │   │    └─ controls → <ActionBar>  <UndoButton/> <RedoButton/> <HintButton/>
 │   ├─ <PauseDialog>             status === "paused": Resume · Restart level · Rules · Settings
 │   ├─ <ResultModal>             won: time/best/hints → Next level · lost: Retry
 │   ├─ <RulesDialog>             static text; auto-opens once (settings.seenRules)
 │   └─ <SettingsDialog>          haptics, show timer, Start over
 └─ <Finale>                      all levels done: total of best times · Start over
```

`<Dialog>` is one new shared primitive (`src/ui/Dialog.tsx`): `div role="dialog" aria-modal`, backdrop, focus moved in on open and restored on close, Tab cycles inside it, Escape calls `onClose` when provided, the rest of the screen is `inert`. `ResultModal`'s hand-rolled trap is replaced by it (its Tab-swallowing was valid only for a single button). It stays a `div`, not `<dialog>`, for jsdom (`BOARD_DESIGN.md` decision 5).

### 7.2 Timer, pause, action bar

- **Clock driver:** a `useClock()` hook in `GameScreen`. While `status === "playing"` it runs a 500 ms interval and calls `tick(now - last)` using `performance.now()` deltas, so a delayed interval does not lose time. The store is pure; time is injected by the hook, never read by the store.
- **Auto-pause:** `visibilitychange → hidden` and `window blur` dispatch `pause`. This covers minimizing on desktop and backgrounding on mobile. The player returns to the Pause dialog and presses Resume.
- **Manual pause:** the pause button and `Esc`. The paused state hides the board (the Pause dialog backdrop is opaque over the board area) so pausing is not a way to study the puzzle with the clock stopped.
- **Timer display:** `m:ss` (`h:mm:ss` past an hour) from `Math.floor(elapsedMs / 1000)` selected from the store, so it re-renders once a second, not on every tick.
- **Action bar:** Undo and Redo disabled when their stack is empty; Hint disabled unless `playing` and `hearts > 1`; it shows the remaining hearts it will leave (the cost is visible before use). All three are real buttons with accessible names, shown in the `controls` slot (side panel in the wide layout, under the board in the tall one). The button hit area is at least 44 px (`MOBILE_DESIGN.md` §4.3).

### 7.3 Dialogs

- **ResultModal (won):** "You solved it", the time, "Best: m:ss" (or "New best"), "Hints: n" if any, and one button: "Next level" (or "Finish" on the last level). Focus lands on that button. (lost): "Out of hearts" and "Retry", as today.
- **RulesDialog:** the four rules from `DESIGN.md` §1 in plain text, the input cheat sheet (tap = ✕, hold = face; keyboard keys), and a "Got it" button. No interactive board; that is milestone 6.
- **SettingsDialog:** two switches and "Start over" with a confirm step. Opened from the Pause dialog.

### 7.4 Finale

When `progress.next === LEVELS.length` the app shows `<Finale>`: "You finished all N levels", the sum of `bestMs` as total time, and "Start over". It is the only screen that exists without a board. `gameStore` is idle there, and the autosave has removed `save`.

### 7.5 Keyboard and pointer input

Existing per-cell keys stay: `x` toggles ✕, holding `Space` places a face. New:

| Key | Action |
|---|---|
| Arrow keys | Move focus one cell (clamped at the edges, no wrap) |
| `Home` / `End` | First / last cell of the row |
| `z`, `Ctrl/Cmd+Z` | Undo |
| `Shift+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y` | Redo |
| `h` | Hint |
| `Esc` | Pause |

- **Roving tabindex:** `Board` holds `active` (default 0) and passes `tabIndex` 0 to that cell's button and -1 to the rest, so the board is one Tab stop. A cell focus event (mouse included) sets `active`. Arrow handling lives in `Board` on the grid, using `geometry` indices; `CellView` stays presentational.
- **Locked cells stay focusable:** a locked cell (face or wrong ✕) gets `aria-disabled="true"` and ignores input instead of `disabled`, because disabled buttons cannot take focus and the arrow walk would stall on them. The whole board is still `inert` once the game is finished or paused. E2E and unit tests that read `disabled` change to read `aria-disabled` (§9).
- **Shortcuts** are one `useShortcuts()` window listener, active only while `status === "playing"` (so dialogs and the paused state swallow them), ignoring auto-repeat and events with modifiers other than the combos above. They never fire while a hold is in progress.
- **Right-click** marks (`contextmenu` is prevented) and **click-drag paints marks**: a stroke applies the target state of its first cell (✕ if that cell was empty, clear if it was ✕) to every unlocked cell it crosses, as one `applyMarks` group. This is the lowest-priority story and the first to cut (§10). Touch is unchanged: a drag still cancels a hold and paints nothing.

## 8. Desktop window and Rust shell

- `tauri.conf.json`: `minWidth` 420, `minHeight` 560 (an 11×11 board stays above the cell floor recorded in `MOBILE_DESIGN.md` §8; revisit with a measurement), keep the 800×600 default. The wide layout already switches at aspect ≥ 1.2 and width ≥ 36rem.
- `tauri-plugin-window-state` for the remembered size and position, desktop only: a `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` entry registered behind `#[cfg(desktop)]`, with its permission in a new `capabilities/desktop.json` (`platforms: ["macOS", "windows", "linux"]`) so the mobile build never references a missing plugin.
- `tauri-plugin-store` on every platform, `store:default` in `capabilities/default.json`; `@tauri-apps/plugin-store` as a JS dependency. Still no custom `#[tauri::command]`s.

Rust gates (`cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`) must stay green.

## 9. Testing (strict TDD, each row written failing first)

**Node**
- `game.ts`: `tick` (accumulates, ignores bad deltas, only while `playing`); `pause`/`resume` state machine incl. board actions no-op when paused; `applyMarks` (target state, skips locked and no-ops, one group per call, clears `future`); `undo`/`redo` round-trip; invariant "history and future cells are editable" as a property test over random action sequences; `placeFace` prunes stacks; `useHint` places a correct face, costs exactly one heart, can win, is refused at 1 heart and when not `playing`; `feedbackFor` returns `place` (not `wrong`) for a hint; `restart` resets clock, hints, stacks; frozen inputs never mutated (extends `immutability.test.ts`).
- `hints.ts`: §4.4.
- `progress.ts`: `recordWin` (advances, never regresses, keeps min best), `startOver`, clamping.
- `persist.ts`: round-trip `toSaved`/`fromSaved`; rejection table (wrong level id, wrong length, bad cell value, wrong index not a mark, hearts 0 or 4, negative elapsed, non-integer hints); a fuzz test that `fromSaved` never throws on arbitrary JSON.
- `parseSettings`/`parseProgress`: garbage in, defaults out.
- Storage: `MemoryStorage` and `LocalStorageStorage` contract tests (same suite for both); a throwing `localStorage` does not throw; `TauriStorage` with the plugin mocked.
- `campaign.ts`: §3.1. Import-boundary test (`engine/isolation.test.ts`) still passes: `engine/hints.ts` imports only engine.

**jsdom components**
- `Dialog`: focus in, Tab cycles, Escape closes, focus restored, siblings `inert`.
- `GameScreen` with `MemoryStorage`: undo/redo/hint buttons enable and disable correctly; the clock advances under fake timers; `visibilitychange` pauses; Pause dialog resumes; haptics are silent when `settings.haptics` is false.
- `Board`: arrow-key focus movement and clamping; one tab stop; locked cells are focusable and `aria-disabled`; right-click marks; a drag stroke is one undo step.
- `ResultModal`/`Finale`: win shows time and best; last level says "Finish".
- Autosave: a sequence of moves writes the expected `save`; ticks do not write; win clears it; `pagehide` flushes.
- Boot: valid save restores paused with the same hearts and board; invalid save is discarded; storage that throws on read still boots.

**E2E (Playwright, desktop `chromium`; mobile projects get the resume spec)**
- Campaign: win level 1, press "Next level", land on level 2 of N, the board size matches the pack.
- Resume: place a face, mark a cell, lose a heart, reload the page, see the Pause dialog, Resume, and find the same board and hearts (`LocalStorageStorage` in the browser). A corrupted `doku:save` value yields a fresh level, no crash.
- Finale: via the dev override on the last level, win it, see "Finish" then the Finale, "Start over" returns to level 1.
- Keyboard-only level: arrows, `x`, hold `Space`, `z`, `h`.
- Existing specs update for `aria-disabled` and the `?level=` override; each Playwright test starts with empty storage (fresh context).
- Not testable in CI and therefore manual: Tauri store file on disk, window-state restore, kill-and-relaunch on iOS.

**Manual pass** (checklist in the PR, `DESIGN.md` §11): desktop and iOS simulator: play two levels, force-quit mid-level and relaunch (board, hearts, clock restored, paused), minimize and return (auto-pause), resize the window to the minimum and restore it across a relaunch, settings persist, haptics toggle takes effect.

## 10. Issue breakdown

Titled `M4-NN` in a "full-app" GitHub milestone (rename the pending "Full desktop app" milestone), each with Gherkin acceptance criteria as in M1 to M3. Dependencies in brackets.

1. **M4-01 Seed pack and campaign order:** §3.1. `pack-1.json`, `campaign.ts`, `tools/seed-pack.ts`, remove `demoLevel.ts`.
2. **M4-02 Timer and pause:** `tick`/`pause`/`resume`, `useClock`, auto-pause, `<Dialog>`, `PauseDialog`, timer in `TopBar`. §4.2, §7.1, §7.2.
3. **M4-03 Undo and redo for notes:** `applyMarks`, stacks, pruning, `ActionBar` Undo/Redo, `z` shortcuts. [02 for the `Dialog`-free parts only; can start in parallel]
4. **M4-04 Hints:** `engine/hints.ts`, `useHint`, Hint button, `h`. §4.4.
5. **M4-05 Storage seam:** `Storage`, three adapters, `tauri-plugin-store` wiring and capability. §5.1, §8.
6. **M4-06 Settings and rules:** settings store and persistence, `SettingsDialog`, `RulesDialog`, haptics gating. [05, 02]
7. **M4-07 Level progression:** `progress.ts`, `campaign.ts` flow, `GameScreen` without props, `ResultModal` stats and "Next level", `Finale`, `?level=` override. [01, 02, 05]
8. **M4-08 Save and resume:** `persist.ts`, autosave, flush on hide, restore paused. [07]
9. **M4-09 Keyboard play:** roving tabindex, arrows, `aria-disabled`, global shortcuts. [03, 04]
10. **M4-10 Desktop window:** minimum size and remembered size. §8. Independent.
11. **M4-11 Right-click and drag-paint marks:** §7.5. [03] First to cut.
12. **M4-12 E2E for the full app:** §9 E2E. [07, 08, 09]
13. **M4-13 Docs sync:** §12.

## 11. Open questions

1. **Timer on by default.** Default: shown, hideable. A visible clock can add pressure to a relaxed puzzle; say if it should default off.
2. **Hint cost.** Decided: one heart, disabled on the last heart. Open: whether a hinted win should still set `bestMs`. Default yes. Revisit with milestone 5's technique hints.
3. **Restoring into `paused`.** Default yes (§5.2). The cost is one extra tap on relaunch.
4. **Seed pack quality.** Sizes ascend as a difficulty proxy, but a 7×7 can be harder than an 8×8 until milestone 5 rates levels. If the naive script cannot make large unique levels, the pack is shorter than 8 and the finale arrives early; acceptable for this milestone.
5. **Start over.** Default keeps `bestMs`. A full wipe (including bests) would be a second option in Settings; not planned.
6. **Stars.** Dropped (`DESIGN.md` §5, §7 mention them as proposed). Reinstate only with a rule that is worth the UI.

## 12. Doc sync checklist (M4-13)

- `DESIGN.md` §12 item 4 reads "Full app" with the contents above (renamed in the same change as this document). §5: new statuses, state fields and actions; remove `dailyStore`, keep `progressStore` (`next`, `bestMs`) and `settingsStore`. §6: storage interface and keys. §7: replace the tree with §7.1 here. §8: `input` row gains arrows, `z`, `h`, `Esc`; `storage` row names `TauriStorage` and `LocalStorageStorage`; `window` row names the minimum and window-state. §9: store and window-state plugins, `capabilities/desktop.json`. §10: seed pack and `tools/seed-pack.ts`. §13: add the decisions below.
- `BOARD_DESIGN.md`: §3 state notes the added fields; §4.2/§4.3 the roving tabindex and `aria-disabled`; the "level select, persistence, undo/redo…" out-of-scope line already describes this milestone.
- `README.md`: docs index (done with this document); nothing else.
- `MOBILE_DESIGN.md` §6.3 (haptics setting) and §10 question 5 are resolved by §6 here.

## 13. Decisions

1. **No level select.** Levels play in a fixed order; the app opens on the current one. `HomeScreen`, `LevelSelectScreen`, `DailyCard` and `ContinueCard` are removed from the design.
2. **Progress is one integer plus best times** (`next`, `bestMs`), not a per-level completion map.
3. **Seed pack first, generator later.** The pack format is what milestone 5 targets; the naive seed script is disposable.
4. **Undo/redo is for ✕ notes only.** Faces and wrong taps are locked, so hearts can never be refunded and a known-wrong cell stays known.
5. **Hearts, wrong cells and elapsed time are persisted** so quitting cannot reset a mistake.
6. **Restore into `paused`.** Time does not run until the player resumes.
7. **Hints cost a heart** and are refused on the last one. They are a stub on the stable signature: the first unsolved row's solution cell; technique explanations arrive with milestone 5.
8. **Pure store, injected time.** The store never reads a clock; `useClock` passes deltas.
9. **Unversioned saves that validate or are discarded**, per the pre-MVP rule.
10. **One screen, shared `<Dialog>`** for pause, rules, settings and results.
