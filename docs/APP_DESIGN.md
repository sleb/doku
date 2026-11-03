# Doku: Milestone 4 low-level design (full app)

Companion to `DESIGN.md` §5, §6, §7, §8 and §12 for milestone 4 ("Full app"). It turned the single-level game into an app a person can open, play through a series of levels, quit, and come back to: campaign progression, persistence, timer and pause, undo/redo, hints, settings, keyboard play and the desktop window. The engine, the board and the mobile work (`docs/ENGINE_DESIGN.md`, `docs/BOARD_DESIGN.md`, `docs/MOBILE_DESIGN.md`) are consumed as-is except where stated. `DESIGN.md` was synced to this document in M4-12; if the two disagree, fix whichever is wrong.

**Status:** implemented (M4-01 to M4-11, issues #72 to #82) and synced (M4-12). Automated coverage is unit, jsdom and Playwright (desktop Chromium plus the two mobile projects). The manual checks listed in §9 ("Remaining manual verification") have not been done; in particular window-state restore, the Tauri store file on disk and kill-and-relaunch on iOS are unverified on real runtimes.

## 1. Goals and non-goals

**Goal:** launching the app drops the player straight into their current level. Winning offers "Next level"; losing offers "Retry". Levels come in a fixed order and there is no level select, no home screen and no menu of levels. Quitting at any moment (including a force-kill on a phone) and relaunching puts the player back where they were, with the same hearts and elapsed time, paused. The same build works on desktop and iOS (Android when #64 lands).

**Non-goals:**
- Level select, home screen, daily puzzle, stars (`HomeScreen`, `LevelSelectScreen`, `DailyCard`, `ContinueCard` are dropped, not deferred).
- A generator, difficulty rating or the technique-explained hint (milestone 5). Levels come from a small bundled seed pack (§3.1).
- Sound, animations, color-blind palette, themes, the interactive tutorial (milestone 6). Android specifics (#64, #70).
- Right-click and click-drag marking (dropped from the design until someone asks; click and hold are the only pointer gestures).
- Accounts, cloud sync, leaderboards (`DESIGN.md` decision 5).

## 2. Architecture at a glance

| Piece | Where |
|---|---|
| Ordered level list | `src/levels/campaign.ts` (`LEVELS`, `levelIndex`) from `src/levels/pack-*.json` |
| Pure game transitions, thin Zustand binding | `src/store/game.ts`, `gameStore.ts` |
| Progress, settings (pure parse + Zustand + hydrate/persist) | `src/store/progress.ts`, `settings.ts` |
| Save format | `src/store/persist.ts` (`toSaved`, `fromSaved`) |
| Storage seam | `src/platform/storage.ts` |
| Wiring: boot, autosave, campaign flow | `src/app/boot.ts`, `autosave.ts`, `campaign.ts` |
| UI | `src/App.tsx`, `src/ui/Dialog.tsx`, `src/ui/screens/*`, `src/ui/hud/*`, `src/ui/board/*` |
| Desktop window | `src-tauri/tauri.conf.json`, `capabilities/desktop.json`, `tauri-plugin-window-state` |

Note the two `campaign.ts` files: `src/levels/campaign.ts` is only the ordered level list; `src/app/campaign.ts` owns the flow between stores.

## 3. Levels and progression

### 3.1 Pack format and seed pack

A pack is a JSON file `{ "levels": Level[] }` in `src/levels/` (`pack-*.json`, the format `DESIGN.md` §10 names). `src/levels/campaign.ts` loads every pack through `loadLevel` (which rejects malformed levels) with `import.meta.glob("./pack-*.json", { eager: true })`, ordered by `orderPackKeys` (`src/levels/packOrder.ts`: numeric suffix, so `pack-2` precedes `pack-10`), and exports:

```ts
export const LEVELS: readonly Level[];            // concatenation of packs in numeric pack order
export function levelIndex(id: string): number;   // -1 if unknown
```

Level `id`s are unique across packs (tested). The campaign order is the array order; there is no per-level metadata beyond the engine's `Level`.

**Seed pack (`pack-1.json`)** has 8 levels in this order: `demo-7` (7), `demo-11` (11), `seed-1` (7), `seed-2` (7), `seed-3` (9), `seed-4` (9), `seed-5` (10), `seed-6` (8). Difficulty is not curated or rated until milestone 5. `demo-7` and `demo-11` were folded in from the earlier demo levels. The rest come from the throwaway script `tools/seed-pack.ts` (random valid placement, grow regions, keep if `countSolutions == 1`), a naive precursor of the milestone 5 generator. The script found a unique 10×10 but **no unique 11×11 within its 60 s budget, so `demo-11` is the only 11×11 in the pack** (§11 question 4). Run it as `bun tools/seed-pack.ts [size:count ...]` (sizes below 4 are rejected up front: 2x2 and 3x3 have no valid placement and would loop forever); it prints Level JSON lines to append by hand.

Tests (node): every level passes `validateLevel`, `countSolutions(level) === 1`, size is in 7–11, ids are unique, the pack is non-empty.

### 3.2 Progress

```ts
interface Progress {
  next: number;                       // index into LEVELS of the level to play; === LEVELS.length means finished
  bestMs: Record<string, number>;     // level id -> best winning time
}
```

`src/store/progress.ts` has pure transitions plus a thin Zustand binding, the same split as `game.ts` / `gameStore.ts`:

- `recordWin(p, index, elapsedMs)` (the id is `LEVELS[index].id`) → `next = max(p.next, index + 1)`, `bestMs[id] = min(existing, elapsedMs)`. Replaying never moves `next` backward and never raises a best. A hinted win still sets a best. The store action wrapping it is named `record(index, ms)`.
- `startOver(p)` → `next = 0`, keeps `bestMs`.
- `currentLevel(p)` → `LEVELS[p.next]` or `null` when finished.
- `parseProgress(raw, count)` is total and pure: `next` is clamped to an integer in `[0, count]` (so a pack that shrinks between versions cannot strand the player), and non-finite, negative or non-number `bestMs` entries are dropped.
- `hydrateProgress` / `persistProgress` follow the settings pattern: hydrate first, then write on change under the key `progress`.

### 3.3 Flow

`src/app/campaign.ts` is the only code that starts levels. Components call its functions:

- `recordWins()`: a `gameStore` subscription that calls `progress.record` exactly on the transition into `won` (never on restore: wins are never saved). The win is recorded when it happens, so quitting on the result modal and relaunching starts the next level. Returns its unsubscribe.
- `startCurrent()`: start `currentLevel(progress)`, or go idle when the campaign is finished.
- `nextLevel()`: the "Next level" / "Finish" handler; the same as `startCurrent()`.
- `startOver()`: progress `startOver`, then `startCurrent()`.
- Retry is `gameStore.restart()`, called directly by the result modal; there is no `retry()` in the module.

Win on the last level records `next === LEVELS.length`; the result modal's button then reads "Finish" and `nextLevel()` goes idle, which is when `App` shows `<Finale>` (§7.4). Level numbers shown to the player are `index + 1` of `LEVELS.length`.

**Boot order** (`boot(storage, { devLevel })` in `src/app/boot.ts`, called from `main.tsx` through `launch` (`src/app/launch.ts`), which renders only after it settles; if boot rejects, `launch` logs it with `console.error`, calls `startCurrent()` and still renders):

1. Tear down any previous boot's subscriptions (re-boot in tests and hot reload).
2. `hydrateSettings`, then install `persistSettings`.
3. If a dev override is set: start that level and stop here (see below).
4. `hydrateProgress`, then install `persistProgress` and `recordWins`.
5. Restore the saved game if `fromSaved` accepts it for the level progress points at (state comes back `paused`); otherwise remove the stale or unreadable `save` and `startCurrent()`.
6. Install autosave **after** the restore, so restoring does not write itself back.

**Dev override:** `?level=<id>` (only when `import.meta.env.DEV`) is parsed by the pure `devLevelOverride(search, isDev)` and passed as `devLevel`. Settings are still hydrated and persisted (so `seenRules` and haptics behave normally and the first-launch Rules still open), but the saved game and progress are ignored and not written: no win recording, no progress persistence, no autosave. An unknown id boots normally. It exists to keep the e2e specs that need the 11×11 board deterministic. Production builds have no override.

**The Finale is not reachable through the override**, because the override records nothing. The Finale e2e seeds `doku:progress` one level short of the end and boots normally.

## 4. Game state (`src/store/game.ts`)

### 4.1 Shape

```ts
type GameStatus = "idle" | "playing" | "paused" | "won" | "lost";

type Started = {
  status: "playing" | "paused" | "won" | "lost";
  level: Level; board: Board; wrong: ReadonlySet<number>; hearts: number;
  hintsUsed: number;
  elapsedMs: number;
  history: readonly number[];   // undo stack: cells whose mark was flipped, oldest first
  future: readonly number[];    // redo stack
};
```

The idle state is `{ status: "idle", level: null, board: null, hearts }`. `Started` is exported. State machine: `idle → playing ⇄ paused → won | lost`; `restart` and `startLevel` go to `playing` from anywhere (`restart` is a no-op on idle). The stacks are deliberately not persisted.

### 4.2 Transitions (all pure, all return new objects; engine immutability rules apply)

| Transition | Behavior |
|---|---|
| `tick(s, dtMs)` | `playing` only: `elapsedMs += dtMs`. Negative or non-finite `dtMs` is ignored. |
| `pause(s)` / `resume(s)` | `playing → paused` / `paused → playing`; anything else is a no-op. While `paused` every board action is a no-op (the `editable` guard requires `playing`). |
| `toggleMark(s, cell)` | Flips the player's ✕ on an editable cell, pushes `cell` on `history` and clears `future`. A toggle on a locked cell pushes nothing and leaves `future` alone. |
| `undo(s)` / `redo(s)` | Pop a cell from `history` (or `future`), flip its mark (Mark ↔ Empty, no before/after tagging), push the cell on the other stack. Never touch `hearts`, `wrong` or `elapsedMs`. No-op (same reference) on empty stacks or when not `playing`. |
| `placeFace(s, cell)` | Correct: face (replacing a ✕), win detection. Wrong: heart lost, locked red ✕. Whichever way it resolves, the cell becomes locked, so it is removed from every entry of `history` and `future`. |
| `hint(s)` | `playing` only. `nextHint(board, level)` returns a cell; the transition commits a correct face there exactly as `placeFace` does (via the shared `commitFace`, so it can win the level and overwrites a ✕ note, pruning the stacks), increments `hintsUsed` and costs one heart. Same reference (no-op) when not `playing`, when `hearts <= 1` (a hint can never end the level in a loss), or when no row is open. |
| `restart(s)` / `startLevel(l)` | Reset to a fresh board: hearts 3, `elapsedMs` 0, `hintsUsed` 0, empty stacks. |

The transition is named `hint`, and so is the store action `hint()`. (It was planned as `useHint`; Biome's hooks lint flags any `use*` call outside a component.)

**Invariant (property-tested):** every cell in `history` and `future` is currently editable (not a face, not wrong). Hence `undo`/`redo` never need a guard against locked cells.

**Undo covers notes only.** Faces and wrong ✕s are locked by design (`BOARD_DESIGN.md`, decision 7), and a wrong tap spends a heart that must never come back. Making wrong taps undoable would either refund hearts or leave a heart-less undo that re-opens a cell the player now knows is wrong; neither is worth it. Undo/redo is the tool for ✕ notes, which is where mistakes actually happen. A hint's face is locked like any other face.

### 4.3 Hearts, timer and the lose/win result

`won`/`lost` freeze `elapsedMs`. `restart` after a loss resets the clock. The result modal reads `elapsedMs` and `hintsUsed` from state; nothing else about the result is stored.

### 4.4 Engine addition: `src/engine/hints.ts`

`DESIGN.md` §4 plans `nextHint(board, level) → { cell, technique, explanation }`, built on the technique ladder (milestone 5). This milestone ships a stub:

```ts
export function nextHint(board: Board, level: Level): number | null;   // the cell index
```

It returns the solution cell of the first row (top to bottom) that has no face yet, or `null` when every row has one. The result is always correct and always editable (a wrong ✕ can never sit on a solution cell; a player ✕ can, and `placeFace` allows it). Milestone 5 changes the return to the object form with `technique` and `explanation` and changes which cell is chosen; callers read only the cell until then.

**A hint costs one heart** (`DESIGN.md` §13 decision 2 holds: 3 hearts, no recovery), so hints are naturally capped at two per level and trade directly against mistakes. The Hint button is disabled on the last heart. The count is recorded and shown on the result. `feedbackFor` reads a `hintsUsed` increase as `place` (a hint is a deliberate, correct face), checked after win/lose and before the heart-drop check so it is not mistaken for `wrong`.

## 5. Persistence

### 5.1 `Storage` seam (`src/platform/storage.ts`)

```ts
export interface Storage {
  get<T>(key: string): Promise<T | undefined>;   // undefined when missing or unreadable; does not validate
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  flush(): Promise<void>;                        // force pending writes to durable storage
}
```

Three adapters:

- `TauriStorage`: `@tauri-apps/plugin-store`, one file `doku.json` (`STORE_FILE`) in the app data dir, loaded lazily. `set` relies on the plugin's debounced autosave; `flush` calls `save()`.
- `LocalStorageStorage`: JSON under a `doku:` key prefix (`doku:settings`, `doku:progress`, `doku:save`), for the browser dev server, Playwright and tests. Any `localStorage` exception (private mode, quota) is swallowed and logged: the game must play without persistence.
- `MemoryStorage` (a `Map`) for node and component tests; also the fallback if `localStorage` is unusable.

`createStorage(deps)` injects `isTauri` (`"__TAURI_INTERNALS__" in window`), `loadTauri`, a `localStorage` getter and `log`; the default singleton is `storage`. Every method resolves and never rejects. The fallback is sticky per session: if the Tauri store fails to load on first use, `LocalStorageStorage` (else `MemoryStorage`) serves the rest of the session, so data is never split across adapters.

Keys: `settings`, `progress`, `save`. Values are plain JSON. **No schema version and no migrations** until the first MVP release (CLAUDE.md): every loader validates its input and discards anything that does not fit, so a changed shape costs a player one reset, not a crash.

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

`toSaved(state): SavedGame | null` (null for `idle`, `won` and `lost`) and `fromSaved(raw, level): Started | null` are pure and live in `src/store/persist.ts`. `fromSaved` is total (never throws; junk in gives `null`) and returns `null` (saved game discarded) unless: `levelId === level.id`, `board.length === size²`, every board value is a valid `Cell`, every `wrong` entry is an integer index that holds a `Mark` and is unique, `hearts` is an integer in `1..MAX_HEARTS` and equals `MAX_HEARTS - wrong.size - hintsUsed` (a wrong tap and a hint each cost exactly one heart), `elapsedMs` is finite and ≥ 0, `hintsUsed` is an integer ≥ 0, the board has no `Face` on a cell where `judgeTap` is `wrong`, and it is not already solved. It returns fresh copies (a new `Uint8Array` and `Set`) with empty `history` and `future`. A restored game comes back **`paused`** whether it was saved `playing` or `paused`, so the clock does not run before the player is looking at it.

### 5.3 Settings and progress parsing

`parseSettings(unknown): Settings` (field-by-field fallback to defaults, extra keys dropped) and `parseProgress(unknown, count): Progress` (§3.2) are total functions: garbage in, defaults out.

### 5.4 Autosave (`src/app/autosave.ts`)

`installAutosave(storage, { debounceMs = 250 })` returns its teardown (subscription, pending timer, `visibilitychange` and `pagehide` listeners).

- A `gameStore` subscription writes `save` when any of `board`, `wrong`, `hearts`, `hintsUsed` or `status` changed (shallow compare, so the 500 ms clock ticks do not write). Pausing therefore writes, which persists `elapsedMs`. While `playing`, a tick that leaves `elapsedMs` at least 5 s past the last write also schedules a write (so a hard kill loses at most about 5 s, not everything since the last move). Writes are coalesced with a 250 ms trailing debounce.
- Entering `won`, `lost` or `idle` cancels the pending timer and removes `save`, so a late debounce cannot resurrect a finished save.
- **Flush** on `visibilitychange → hidden` and `pagehide`: write the latest save immediately (reading the store at call time, so it includes the current `elapsedMs`; a kill loses at most the time since the last background or the 5 s refresh) and call `storage.flush()`. On mobile this is the only reliable moment before the OS kills the process; on desktop it also fires on minimize.
- A rejected `set`/`flush`/`remove` is swallowed; the next change retries naturally.
- Progress and settings write immediately on change (they change rarely).

Consequence for e2e: specs that reload find the game paused (Resume) rather than playing. Specs run with `doku:settings` seeded `seenRules: true` via `storageState` in `playwright.config.ts`.

## 6. Settings

```ts
interface Settings { haptics: boolean; seenRules: boolean }
// defaults: { haptics: true, seenRules: false }
```

`src/store/settings.ts`: pure `parseSettings`, a thin Zustand binding with `set(patch)`, `hydrateSettings` / `persistSettings` (hydrate first so loading does not write back), persisted on every change. Consumers:
- The haptics subscription in `GameScreen` plays a buzz only if `settings.haptics`, read at event time (resolves `MOBILE_DESIGN.md` §6.3). The desktop adapter is already a no-op.
- `seenRules` triggers the rules dialog on first launch (§7.3) and is set when it is dismissed.

Theme, sound and the color-blind palette are milestone 6 and add fields then. The settings dialog also hosts "Start over" (§7.3), the one destructive action.

## 7. UI

### 7.1 Component tree

```
<App>                              progress.next === LEVELS.length && status idle ? <Finale/> : <GameScreen/>
 ├─ <GameScreen>                   view of gameStore; no props
 │   ├─ <GameLayout>
 │   │    ├─ header   → <TopBar>  "Level n of N" · <Timer/> · <Hearts/> · Pause button
 │   │    ├─ board    → <Board>   (roving focus, §7.5)
 │   │    └─ controls → <ActionBar>  Undo · Redo · Hint
 │   ├─ <PauseDialog>             status === "paused": Resume · Restart level · Rules · Settings
 │   ├─ <ResultModal>             won: time/best/hints → Next level | Finish · lost: Retry
 │   ├─ <RulesDialog>             static text; auto-opens once (settings.seenRules)
 │   └─ <SettingsDialog>          Haptics switch, Start over (with confirm)
 └─ <Finale>                      all levels done: total of best times · Start over
```

There is no router. `<Dialog>` (`src/ui/Dialog.tsx`) is the one shared primitive: `div role="dialog" aria-modal`, backdrop, focus moved in on open (to `[data-autofocus]` or the first focusable) and restored on close, Tab cycles inside it, Escape calls `onClose` when one is provided, and its siblings are `inert`. It stays a `div`, not `<dialog>`, for jsdom (`BOARD_DESIGN.md` decision 5). `ResultModal` is built on it.

### 7.2 Timer, pause, action bar

- **Clock driver:** `useClock()` (`src/ui/screens/useClock.ts`). While `status === "playing"` it runs a 500 ms interval and calls `tick(now - last)` using `performance.now()` deltas, so a delayed interval does not lose time. A gap over 1.5 s (3 intervals) is treated as a suspension the page never saw (no blur or visibilitychange) and credits one interval (500 ms) instead of the whole gap; this applies to flushes too. `pause`, `hint` and `placeFace` first call the registered flush (`onClockFlush` in `gameStore.ts`), which credits the time since the last tick while the status is still `playing`, so pausing, winning or losing does not drop the partial 500 ms interval; auto-pause and Esc go through `pause`, so they are covered. The store is pure; time is injected by the hook, never read by the store.
- **Auto-pause:** `useAutoPause()` dispatches `pause` on `visibilitychange → hidden` and window `blur`. This covers minimizing on desktop and backgrounding on mobile. Resume is never automatic: the player returns to the Pause dialog and presses Resume.
- **Manual pause:** the Pause button in `TopBar`, and `Esc` (handled by `useShortcuts`; Esc only pauses, it never resumes). The paused board stays mounted but `inert` and `visibility: hidden`, so pausing is not a way to study the puzzle with the clock stopped.
- **Timer display:** `m:ss` (`h:mm:ss` past an hour) from `Math.floor(elapsedMs / 1000)` selected from the store, so it re-renders once a second, not on every tick. The timer is always shown; there is no setting to hide it. `GameScreen` reads `elapsedMs` only while `won` (for the result), so ticks do not re-render the screen or the board.
- **Action bar** (`ActionBar.tsx`): three real buttons in one row in the `controls` slot (side panel in the wide layout, under the board in the tall one), each at least 44 px (`min-h-11 min-w-11`, `MOBILE_DESIGN.md` §4.3). Undo and Redo are disabled unless `playing` and their stack is non-empty. Hint is labelled "Hint" with a small non-wrapping "-1 ♥" cost marker and `aria-label="Hint, costs one heart"`, disabled unless `playing` and `hearts > 1`. All are disabled while paused, so a paused board cannot be studied.
- **Shortcuts:** `useShortcuts({ holdOwner })` is one window `keydown` listener, active only while `status === "playing"` (so dialogs and the paused state swallow them). See §7.5.

### 7.3 Dialogs

- **PauseDialog:** Resume (autofocused), Restart level, Rules, Settings. It passes no `onClose`, so Escape does not close it.
- **Sheets:** `GameScreen` holds `sheet: "rules" | "settings" | null`. While a sheet is open the Pause dialog is unmounted and returns on close (Escape or the button), without resuming.
- **ResultModal:** won: "You solved it", "Time: m:ss", "New best" when `elapsedMs <= best` (the win is already recorded, so a first win or a tie shows it) otherwise "Best: m:ss", "Hints: n" only when n > 0, and one button: "Next level" (or "Finish" on the last level), which takes focus. Lost: "Out of hearts" and "Retry". It receives `elapsedMs`, `bestMs`, `hintsUsed` and `isLast` as props.
- **RulesDialog:** the four rules in plain text and the input cheat sheet (tap = ✕, hold = face, arrows, `x`, Space, `z`, `h`), and a "Got it" button; Escape also closes it. No interactive board; that is milestone 6. On first launch (`!seenRules` and a level loaded) Rules open over a game that is **paused** (clock stopped); dismissal sets `seenRules: true` and resumes straight to play. `firstRules` is derived from `seenRules`, not an effect, so StrictMode cannot reopen it.
- **SettingsDialog:** a `role="switch"` Haptics control, "Start over" and "Done". "Start over" swaps to an inline confirm ("Start over? Your best times are kept." with Confirm and Cancel); Escape cancels the confirm first (a second Escape closes the dialog); Confirm calls `campaign.startOver`, then pauses (level 1 comes up behind the Pause dialog, not running) and closes the sheet. Start over shipped with M4-07 (level progression), not with M4-06 (settings).

### 7.4 Finale

When `progress.next === LEVELS.length` and `gameStore.status === "idle"`, `App` shows `<Finale>`: "You finished", "Total of best times" (the sum of `bestMs` over the ids in `LEVELS`; if any level has no recorded best the total is replaced by "Some best times are missing, so there is no total.", rather than counting it as 0) and "Start over" (no confirm; unlike Settings it starts level 1 playing, since the player has just chosen to go again). The idle check keeps the last win's result modal ("Finish") from being hidden. It is the only screen that exists without a board. The store is idle there and autosave has removed `save`; a reload stays on the Finale.

### 7.5 Keyboard and pointer input

Per-cell keys (from M2): `x` toggles ✕, holding `Space` places a face. Added in M4-09:

| Key | Action |
|---|---|
| Arrow keys | Move focus one cell (clamped at the edges, no wrap) |
| `Home` / `End` | First / last cell of the row |
| `z`, `Ctrl/Cmd+Z` | Undo |
| `Shift+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y` | Redo (`Cmd+Y` is deliberately not bound) |
| `h` | Hint (plain key only) |
| `Esc` | Pause |

- **Roving tabindex:** `Board` holds `active` (default 0, reset to 0 on a new level) and gives `tabIndex` 0 to that cell's button and -1 to the rest, so the board is one Tab stop. A cell focus event (mouse included) sets `active`. Arrow handling lives in `Board` on the grid, using `geometry` indices; handled navigation keys are default-prevented; arrows with Ctrl/Meta/Alt/Shift are neither handled nor prevented. `CellView` stays presentational.
- **Locked cells stay focusable:** a locked cell (face or wrong ✕) gets `aria-disabled="true"` and ignores click, `x`, Enter and Space-hold, instead of `disabled`, because disabled buttons cannot take focus and the arrow walk would stall. The whole board is still `inert` once the game is finished or paused. Tests that read `disabled` read `aria-disabled`.
- **Focus ring:** cells show a `focus-visible` outline inset past the conflict ring.
- **Focus after Resume:** if focus fell to the page, `GameScreen` focuses the board's tabbable cell. A real browser cannot restore focus onto the `visibility: hidden` board from `Dialog`'s cleanup; the e2e caught this where jsdom did not.
- **Shortcut guards:** `useShortcuts` ignores auto-repeat, Alt and events a dialog already handled (`defaultPrevented`, so Esc closing the first-launch Rules does not also pause), and acts only while `playing`. `GameScreen` owns the `holdOwner` ref (passed to `Board` and `useShortcuts`), so undo, redo and hint do nothing while a cell is held, while `Esc` (without Ctrl/Meta) still pauses.
- **Right-click and click-drag marking are not implemented** (§1).

## 8. Desktop window and Rust shell

- `tauri.conf.json`: default size 800×600, `minWidth` 420, `minHeight` 560. The wide layout switches at aspect ≥ 1.2 and width ≥ 36rem. Whether an 11×11 board stays legible at the minimum has not been measured on a desktop window (§9).
- `tauri-plugin-window-state = "2"` (desktop only) remembers size and position: a `cfg(not(any(target_os = "android", target_os = "ios")))` dependency in `Cargo.toml`, registered behind `#[cfg(desktop)]` with default state flags, no JS package. Its permission `window-state:default` is in `capabilities/desktop.json` (`platforms: ["macOS", "windows", "linux"]`) so mobile builds never reference a missing plugin. State is saved on close, so a force-kill may lose the last position.
- `tauri-plugin-store` on every platform (`store:default` in `capabilities/default.json` with `core:default` and `opener:default`), plus `@tauri-apps/plugin-store` in `package.json`. The mobile-only haptics plugin and `capabilities/mobile.json` are unchanged (`MOBILE_DESIGN.md` §7). Still no custom `#[tauri::command]`s.

Rust gates (`cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`) run in CI. `src/platform/desktopWindow.test.ts` and `capabilities.test.ts` assert the config and capability files from node (minimum size, default size, the window-state permission and target table, `store:default`).

## 9. Testing

**Node:** `game.ts` (every transition above, including the history/future invariant as a property test, `hint` rules, frozen inputs never mutated), `hints.ts`, `progress.ts`, `persist.ts` (round-trip, rejection table, fuzz that `fromSaved` never throws), `parseSettings`/`parseProgress`, `storage` (`MemoryStorage` and `LocalStorageStorage` share one contract suite; a throwing `localStorage` does not throw; `TauriStorage` with the plugin mocked), `levels/campaign.ts`, `desktopWindow` and `capabilities`. The import-boundary test (`engine/isolation.test.ts`) still passes: `engine/hints.ts` imports only engine.

**jsdom components:** `Dialog`, `GameScreen` with `MemoryStorage` (buttons enable/disable, fake-timer clock, auto-pause, Pause dialog, haptics silent when disabled, Tab enters on the active cell, Resume restores focus), `Board` (arrows, clamping, Home/End, one tab stop, locked cells focusable and `aria-disabled`), `ResultModal`, `Finale`, `useShortcuts`, `useAutoPause`, `useClock`, `autosave` (writes, ticks do not write, win clears, `pagehide` flushes), `boot` (valid save restores paused, invalid save discarded, throwing storage still boots, win, dev override and re-boot guards).

**E2E (Playwright; the `chromium` project runs every spec except `mobile.spec.ts`, which runs on `mobile-chromium` and `mobile-webkit`):**
- `playthrough.spec.ts`: win, then "Next level" lands on level 2 of N; lose and Retry; hold and click gestures.
- `resume.spec.ts`: place a face, mark a cell, lose a heart, let the clock run, reload; the Pause dialog is up, the clock is stopped, and Resume shows the same board and hearts. The scenario lives in `e2e/resumeFlow.ts` and is shared with the touch variant in `mobile.spec.ts`. A corrupt `doku:save` (not an object, wrong-length board, another level's id, zero hearts, unparsable JSON) boots a fresh level with no page error and no leftover save.
- `campaign.spec.ts`: progress survives a reload and the game resumes paused on level 2. Finale: the test seeds `doku:progress` one level short of the end and boots normally (the `?level=` override records nothing and cannot reach it). It wins the last level, sees "Finish" (no "Next level"), then the Finale; a reload stays on the Finale; "Start over" returns to level 1 and keeps best times. Settings "Start over" asks first, Escape cancels only the confirm, Confirm rewinds to a paused level 1. The override leaves `doku:progress` and `doku:save` untouched; an unknown id boots level 1.
- `keyboard.spec.ts` (a level played from the keyboard alone), `hint.spec.ts`, `pause.spec.ts`, `settings.spec.ts` (first-launch Rules, corrupt settings, haptics persists), plus the layout, webview, borders and smoke specs from earlier milestones.
- Helpers in `e2e/helpers.ts`: `seed`/`seedRaw` (a once-per-tab init script so a reload keeps live state), `storageValue`/`storageJson`, `solve`, touch helpers. The M4-11 specs avoid `waitForTimeout`: autosave is awaited with `expect.poll` and the clock is driven with `page.clock` (`pause.spec.ts` and the gesture tests in `playthrough.spec.ts` still use fixed waits). Each test starts with empty storage apart from the `seenRules` seed.

**Remaining manual verification (not done; none of these can run in CI):**
- Desktop (`bun tauri dev` / a release build): the `doku.json` store file is written to the app data dir and a relaunch restores board, hearts and clock paused; window size and position are restored across a relaunch (window-state); the window cannot be resized below 420×560, and an 11×11 board is legible at that size; minimize and return auto-pauses; the haptics toggle persists.
- iOS (simulator and device): play two levels, force-quit mid-level and relaunch (board, hearts, clock restored, paused; the `pagehide`/hidden flush actually reaches `doku.json`); background and return auto-pauses; settings persist; haptics toggle takes effect on a device.
- Android: all of the above once #64 lands.

## 10. Issue breakdown

All done, titled `M4-NN` in the "full-app" GitHub milestone: 01 Seed pack and campaign order (#72), 02 Timer and pause (#73), 03 Undo and redo (#74), 04 Hints (#75), 05 Storage seam (#76), 06 Settings and rules (#77), 07 Level progression (#78, includes Start over and the Finale), 08 Save and resume (#79), 09 Keyboard play (#80), 10 Desktop window (#81), 11 E2E for the full app (#82), 12 Docs sync (#83).

## 11. Open questions

1. **Resolved:** the timer is always shown; there is no setting to hide it.
2. **Hint cost.** Decided: one heart, disabled on the last heart. A hinted win sets `bestMs` like any other. Revisit with milestone 5's technique hints.
3. **Restoring into `paused`.** Decided yes. The cost is one extra tap on relaunch.
4. **Seed pack quality.** Levels are a mix of sizes in any order until milestone 5. The naive script found no unique 11×11, so the pack has a single 11×11 (`demo-11`) rather than several; milestone 5's generator replaces the pack.
5. **Start over.** Keeps `bestMs`. A full wipe (including bests) would be a second option in Settings; not planned.
6. **Stars.** Dropped. Reinstate only with a rule that is worth the UI.

## 12. Doc sync (M4-12, done)

- `DESIGN.md` §2, §3, §5, §6, §7, §8, §9, §10, §12 and §13 updated to this document; right-click and drag marks removed from §8; `dailyStore` and stars dropped.
- `BOARD_DESIGN.md`: state, actions, props and screens updated for the M4 additions, with a banner that the rest is the M2 design.
- `MOBILE_DESIGN.md`: haptics setting (§6.3, §10 question 5) resolved by §6 here; the controls slot and the persistence non-goal are now delivered.
- `README.md`: docs index and commands.

## 13. Decisions

1. **No level select.** Levels play in a fixed order; the app opens on the current one. `HomeScreen`, `LevelSelectScreen`, `DailyCard` and `ContinueCard` are removed from the design.
2. **Progress is one integer plus best times** (`next`, `bestMs`), not a per-level completion map.
3. **Seed pack first, generator later.** The pack format is what milestone 5 targets; the naive seed script is disposable.
4. **Undo/redo is for ✕ notes only.** Faces and wrong taps are locked, so hearts can never be refunded and a known-wrong cell stays known.
5. **Hearts, wrong cells and elapsed time are persisted** so quitting cannot reset a mistake.
6. **Restore into `paused`.** Time does not run until the player resumes.
7. **Hints cost a heart** and are refused on the last one. They are a stub on a stable call: the first unsolved row's solution cell; technique explanations arrive with milestone 5.
8. **Pure store, injected time.** The store never reads a clock; `useClock` passes deltas.
9. **Unversioned saves that validate or are discarded**, per the pre-MVP rule.
10. **One screen, shared `<Dialog>`** for pause, rules, settings and results.
11. **No right-click or drag marking.** Click (✕) and hold (face) are the only pointer gestures.
