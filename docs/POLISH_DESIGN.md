# Doku: Milestone 6 low-level design (polish)

Companion to `DESIGN.md` §7 (Theming), §8 (`audio` adapter) and §12 for milestone 6 ("Polish"). Milestone 4 shipped a complete but plain app; this milestone adds the feel (sound, animation), the access (color-blind support, click-only placement, screen-reader announcements, dark theme) and the first-run experience (an interactive tutorial). It consumes the engine, board, mobile and app work as-is except where stated (`docs/ENGINE_DESIGN.md`, `docs/BOARD_DESIGN.md`, `docs/MOBILE_DESIGN.md`, `docs/APP_DESIGN.md`). If this document and `DESIGN.md` disagree on polish, fix whichever is wrong in the docs-sync story (§12).

**Status:** draft for review. Nothing here is implemented.

## 1. Goals and non-goals

**Goals**
- Every outcome (face placed, wrong tap, win, loss) is felt through **three channels from one source**: haptics (exists), sound and animation. One pure function decides the outcome; the channels only render it (§3).
- The game is playable without distinguishing hues (patterns, a color-blind-safe palette), without a timed press-and-hold (#57), and with a screen reader (announcements, labels, an axe-checked UI).
- A first-time player learns the rules by **doing**, on a real board with the real components, in under two minutes.
- Light and dark themes; the board looks the same in both (§8).
- Everything respects `prefers-reduced-motion` and a settings switch for sound, and nothing adds a network call, a bundled audio file or an image asset (original, synthesized, offline).

**Non-goals**
- **Daily puzzle.** `DESIGN.md` §12 still lists it under milestone 6, but §13 decision 13 and `APP_DESIGN.md` §1 dropped it (no home screen to host it, no `dailyStore`, no stars). This milestone follows the decision; the §12 line is corrected in the docs sync. Nothing here blocks adding it later (M5 `seed.ts` already allows `daily/<date>` seeds).
- Music, voice, haptic patterns beyond the four existing kinds, a sound for the free ✕ (`DESIGN.md` §13 decision 10: ✕ is silent and buzz-free, so it stays that way).
- Localization, a custom font, store-listing art, app icon (release work, not polish of the game).
- Android-specific audio, haptics or screen-reader behaviour while #64 is pending; the code is platform-agnostic and the manual pass (§11) covers Android once it builds.
- Level select, stars, leaderboards, accounts (`DESIGN.md` §13).

## 2. Architecture at a glance

```
gameStore ──subscribe──▶ outcomeFor(prev, next) ──▶ Outcome | null        (pure, src/platform/outcome.ts)
                                   │
                  useFeedback() in GameScreen ─┬─▶ haptics.play(kind)       if settings.haptics
                                               ├─▶ sound.play(kind, step)   if settings.sound
                                               ├─▶ fxStore.set(outcome)     → Board/Cell animation classes
                                               └─▶ announcer.say(text)      → <Announcer aria-live>
```

| Piece | Where | New / changed |
|---|---|---|
| `outcomeFor` | `src/platform/outcome.ts` | **Replaces** `feedbackFor`; same rules plus the affected cell and face count |
| Sound adapter | `src/platform/sound.ts` (+ pure `cues.ts`) | new; sibling of `haptics.ts` |
| Effects store | `src/ui/fx/fxStore.ts` | new; transient, never persisted |
| Announcer | `src/ui/a11y/Announcer.tsx`, `announce.ts` | new |
| Region look | `src/ui/board/palette.ts`, `patterns.ts` | changed: palette becomes data keyed by setting; patterns new |
| Theme | `src/app/theme.ts`, `index.css` tokens | new |
| Settings | `src/store/settings.ts` | changed: more fields (§4) |
| Tutorial | `src/ui/tutorial/*`, `src/tutorial/steps.ts` | new |
| Input mode | `src/store/settings.ts`, `ActionBar.tsx`, `Cell.tsx` | changed (#57) |

The game store, `game.ts` and the engine are **not** changed by this milestone. All polish is a subscriber to, or a function of, state that already exists. That keeps the store pure (`APP_DESIGN.md` decision 8) and means saves, autosave and the e2e specs for rules and persistence stay valid.

## 3. One outcome, many channels

### 3.1 `outcomeFor` (replaces `feedbackFor`)

```ts
// src/platform/outcome.ts
export type OutcomeKind = "place" | "wrong" | "win" | "lose";
export interface Outcome {
  kind: OutcomeKind;
  cell?: number;      // the cell the player acted on (place, wrong); absent for win and lose
  faces: number;      // faces on the board after the change (drives the rising pitch, §5.3)
  hearts: number;     // hearts after the change (announcements)
}
export function outcomeFor(prev: GameState, next: GameState): Outcome | null;
```

The decision order is exactly `feedbackFor`'s today (`prev` not `playing` → null; won; lost; hint → place; heart drop → wrong; more faces → place), because that order already handles the corner cases the M4 reviews found (a hint is `place`, not `wrong`; a restore is not an outcome). What is new is `cell`: the single index whose value changed between `prev.board` and `next.board` (for a hint, the committed cell; for a heart drop, the new locked ✕). `HapticKind` becomes an alias of `OutcomeKind`; `haptics.ts` and `GameScreen` import from the new module. `feedback.ts` and its test are deleted and ported (fearless refactor, no shim).

Why one function: three channels disagreeing about what just happened (a buzz for a hint but a "wrong" sound) is the bug to design out. It is also why the tests for "what counts as an outcome" stay in one place (§10).

### 3.2 `useFeedback()` (replaces the inline effect in `GameScreen`)

`src/ui/screens/useFeedback.ts`, called once by `GameScreen`. One `gameStore.subscribe`, one settings read **at event time** (the pattern `GameScreen` uses for haptics today). It also resets `fxStore` and the announcer when the level changes or a save is restored, so a restore never animates or announces itself. It installs the one-time audio **unlock** listener (§5.2).

## 4. Settings changes

```ts
interface Settings {
  haptics: boolean;                       // true
  sound: boolean;                         // true
  theme: "system" | "light" | "dark";     // "system"
  palette: "default" | "accessible";      // "default"
  patterns: boolean;                      // false
  inputMode: "mark" | "face";             // "mark"   (#57, §9.1)
  seenTutorial: boolean;                  // false     (renamed from seenRules, §7.5)
}
```

`parseSettings` stays field-by-field with fallback; unknown enum strings fall back to the default. No migration (CLAUDE.md): a saved `seenRules` is simply dropped, so existing players see the tutorial once.

Sound defaults **on** at a modest master gain (§5.3); the OS volume and the iOS ringer switch (§5.2) are the player's real control. `persistSettings` already writes the whole object on every change; it is extended to the new fields.

**Settings dialog.** It grows from one switch to seven controls, so it gets structure: sections "Feedback" (Haptics, Sound), "Display" (Theme, Colors, Patterns), "Play" (Tap places faces), and the destructive "Start over" at the bottom. A shared `<SwitchRow label>` (`role="switch"`, `aria-checked`, 44 px min) replaces the inline switch; Theme is a three-option `role="radiogroup"`. The dialog body gets `max-h` with `overflow-y-auto` so it scrolls inside the safe area on a landscape phone. "Haptics" is hidden on platforms where the adapter is a no-op (desktop), which is a small fix to M4's always-visible switch.

## 5. Sound

### 5.1 Approach

Synthesized with the Web Audio API: a few oscillators with gain envelopes, no files. This keeps the app original (no licensing, `CLAUDE.md`), adds no bytes to the bundle, loads instantly offline, and lets pitch carry meaning. It works identically in WKWebView, WebView2, WebKitGTK and Android WebView (all have Web Audio). Rust is untouched (`DESIGN.md` §2).

### 5.2 Adapter: `src/platform/sound.ts`

Same shape and discipline as `haptics.ts`: injected deps, always resolves, never throws into gameplay, singleton default.

```ts
export interface Sound {
  play(kind: OutcomeKind, faces: number): void;   // fire and forget
  unlock(): void;                                 // call from a user gesture
  suspend(): void; resume(): void;                // visibility
}
export interface SoundDeps {
  createContext(): AudioContext | null;           // null when Web Audio is missing
  log(err: unknown): void;
}
export function createSound(deps?: SoundDeps): Sound;
export const sound: Sound;
```

- **Autoplay policy.** Browsers and WKWebView start an `AudioContext` suspended until a user gesture. The context is created lazily and `unlock()` (`ctx.resume()`) runs on the first `pointerdown` or `keydown` anywhere, installed by `useFeedback`. `play` before unlock is a silent no-op, not a queued sound (the first move is always a gesture, so nothing audible is lost).
- **Silent switch.** On iOS, Web Audio is muted by the hardware ringer switch, which is the behaviour a game should have (`DESIGN.md` §8 says "respect silent switch"). This is believed, not verified in WKWebView: it is item one on the manual list (§11). If it turns out not to hold, the fallback is a native audio-session category via a Tauri plugin, which would be a deliberate scope change.
- **Backgrounding.** `suspend()` on `visibilitychange → hidden` and `pagehide`, `resume()` on visible, so a sound never leaks over another app or plays from a paused game.
- **Voice limit.** At most 4 live voices; a new `play` while at the limit drops the oldest. Holding down Space and mashing cannot stack into noise.
- Only outcomes sound. Nothing plays while `status !== "playing"` (the outcome function already guarantees it), and the free ✕ and undo/redo are silent.

### 5.3 Cues: `src/platform/cues.ts` (pure)

Each cue is data, so the sound design is unit-testable without audio:

```ts
interface Note { freq: number; at: number; dur: number; type: OscillatorType; gain: number } // seconds
export function cueFor(kind: OutcomeKind, faces: number, size: number): Note[];
```

| Kind | Sound | Notes |
|---|---|---|
| `place` | one soft sine blip, 70 ms | Pitch **rises with the number of faces placed**: step `faces - 1` of a C-major pentatonic ladder spanning ~1.5 octaves across `size` steps, so a finished board has played a rising run. A hint is a `place`. |
| `wrong` | low triangle, 180 ms, small downward glide | Clearly unpleasant but not harsh: gain ≤ the place gain. |
| `win` | four-note arpeggio, 90 ms apart, ending on the octave | ~500 ms, fires with the win animation (§6.3). |
| `lose` | two falling notes | Shorter and quieter than `win`. |

Master gain 0.18 so default is polite; all envelopes ramp from/to 0 over ≥ 5 ms to avoid clicks. Frequencies come from a table, not from float math beyond `2 ** (n / 12)`.

## 6. Animation

### 6.1 Principles

- CSS keyframes and transitions only, no animation library (`APP_DESIGN.md` §7 already uses a CSS transition for hearts and a CSS trace for the hold glow; `index.css` is the home).
- Animate `transform` and `opacity` only. A long list of cells must not trigger layout.
- **Never delay input.** Animation is feedback after the fact: state changes are instant, the visual catches up. The two deliberate delays are the result modal (§6.3), and those are bounded and skippable.
- `@media (prefers-reduced-motion: reduce)` removes movement (scale, shake, wave) and keeps a short opacity change at most, the same rule the hold glow already follows. There is no in-app motion toggle (§12 Q3).

### 6.2 Cell effects: `fxStore`

```ts
// src/ui/fx/fxStore.ts   (vanilla zustand, not persisted)
interface Fx { seq: number; kind: OutcomeKind; cell?: number }
fxStore: { last: Fx | null; set(o: Outcome): void; clear(): void }
```

`Board` selects `last` and passes each `CellView` a primitive `fx?: "place" | "wrong"` plus `fxSeq` only for the one matching `cell`, so the other `N²−1` memoized cells keep identical props and do not re-render (the `Cell` contract in `DESIGN.md` §7). `Cell` stays presentational. The seq is the React `key` of the icon wrapper, so repeating the same effect on the same cell restarts it.

| Effect | Visual | Duration |
|---|---|---|
| `place` | Face scales 0.6 → 1.08 → 1 with a small overshoot, plus a one-shot soft ring that expands and fades from the cell | 220 ms |
| `wrong` | Cell shakes ±3 px (three swings) while the red ✕ fades in; the **Hearts** icon that just emptied does a brief scale-pop then settles to the existing empty style | 280 ms |
| restore / level start | none (`clear()` on level change and restore) | n/a |

A restored game must not replay animations for faces already on the board: effects are keyed to *outcomes*, not to a face existing, so the icon has no mount animation of its own.

### 6.3 Win and loss

- **Win:** faces play a staggered "wave" in row order: `animation-delay: calc(var(--row) * 45ms)`, each a quick hop (`translateY(-18%)` and back, 300 ms). `--row` is set inline per cell by `Board` only during the win (a `data-celebrate` attribute on the grid). Total at size 11 is about 800 ms. The win cue (§5.3) starts with it. `ResultModal` opens after `WIN_DELAY_MS = 900`, driven by a small `useDelayedStatus(status, ms)` hook in `GameScreen` that returns the previous status until the delay passes. Pressing any key or clicking the board area during the delay skips it. Under reduced motion the delay is 0 and there is no wave.
- **Loss:** the final wrong-tap effect plays, hearts empty, and the modal opens after `LOSE_DELAY_MS = 450`. No celebration-style effect.
- The board is `inert` the moment the game finishes, as today; only the *dialog* is deferred. Autosave, progress recording and `recordWins` are triggered by the state change, not the dialog, so a quit during the delay still keeps the win (`APP_DESIGN.md` §3.3).

### 6.4 Dialogs and other transitions

`Dialog` gets a 120 ms fade plus 4 px rise on open (opacity/transform, CSS `@starting-style` or a keyframe on mount), no exit animation (it unmounts, `APP_DESIGN.md` §7.1 "mount it only while open"). Buttons get a `:active` scale of 0.97. No page transitions: there is no router.

## 7. Interactive tutorial

### 7.1 Goal and shape

Replace the static first-launch `RulesDialog` with a short guided play-through that uses the **real** `Board`, `Cell` and gestures, then drops the player into level 1. The static Rules dialog stays reachable from Pause for reference, with a "Replay tutorial" button.

Design constraints:
- It must not touch campaign state. It runs on its own `createGameStore()` instance (`gameStore.ts` already exports the factory), so the campaign store, `save` and `progress` are untouched and autosave is not installed for it.
- Boards are tiny and scripted, not generated, so the lesson is deterministic.
- It cannot be failed. Hearts are not shown; a wrong action explains itself and resets the step.

### 7.2 Steps: data, not code (`src/tutorial/steps.ts`)

```ts
interface TutorialStep {
  id: string;
  title: string;
  body: string;                       // one or two short sentences
  level: Level;                       // 4x4 to 6x6, hand-built, in code
  start?: Board;                      // pre-placed faces and ✕ for the step
  goal: { cell: number; kind: "face" | "mark" }[];   // actions that complete the step
  highlight?: number[];               // cells to ring (the "look here" cue)
  onWrong: string;                    // explanation shown when the player breaks the lesson
}
export const STEPS: readonly TutorialStep[];
```

Planned steps (text is draft, copy is edited in review):

1. **One per region.** A region with one cell left; place its face. (Hold to place: teaches the gesture, since it is the unusual one.)
2. **Rows and columns.** A face already stands; the row and column are shaded; place the face that fits.
3. **No touching.** Show that a diagonal neighbour is also forbidden; the player marks an impossible cell with a tap (teaches ✕).
4. **Notes and undo.** Place two ✕ notes, undo one.
5. **Hearts.** A guided wrong tap: the player is told which cell is wrong, taps it, loses a (display-only) heart and sees the red ✕ and what it means, then places the right one.
6. **Hint.** Shows the Hint button, its heart cost, and (once M5-07 lands, §9.4) the explanation text.

The tutorial boards are below the app's 7..11 size range (`MIN_SIZE` is a *loader* rule in `validate.ts`; the store, `rules.ts` and `judgeTap` have no such limit, and the steps never go through `loadLevel`). Instead, a test asserts every step's `level` is uniquely solvable with `countSolutions` and that the `goal` is consistent with `solution` (§10).

### 7.3 Components

```
<App>  settings.seenTutorial ? <GameScreen/> : <Tutorial/>
 └─ <Tutorial>                   owns the step index and a private game store
     ├─ <TutorialCard>           title · body · Skip · progress "2 of 6"
     ├─ <Board …/>               the same Board component, fed by the private store
     └─ <ActionBar/>-like row    only the controls the step has introduced
```

`Board` already takes everything as props, so it works unchanged. `GameScreen`'s `useClock`, `useAutoPause` and autosave are *not* mounted for the tutorial, so there is no timer and no save. `ActionBar` currently reads the singleton store; it is generalized to take the store as a prop (default: `gameStore`) so the tutorial can show Undo/Hint against its own store. That is the one refactor the tutorial forces on existing code.

### 7.4 Flow

- A step is complete when the private board satisfies `goal`; the card swaps to the next step after a 600 ms beat (immediate under reduced motion). An action that breaks the lesson (a face that is not in `solution`, a ✕ on the answer cell) is undone by the step and `onWrong` is shown in the card's `aria-live` region.
- **Skip** is always available and sets `seenTutorial`. Finishing sets it too. Either way the campaign starts at the player's current level, **paused with Resume**, matching how every other entry behaves.
- Reached again from Pause → "Replay tutorial": it opens over the paused game (as `RulesDialog` does) and closing it returns to the Pause dialog without changing the campaign.
- Keyboard and screen-reader users can complete every step: step 1 uses the Space hold, and in `inputMode: "face"` (§9.1) every step can be done with plain activation. The card text names the actual gesture for the current input mode.

### 7.5 Wiring changes

`seenRules` → `seenTutorial`; `GameScreen`'s `firstRules` logic and the `RulesDialog` auto-open are removed (the tutorial replaces them), while `RulesDialog` and its cheat sheet remain for Pause → Rules. `playwright.config.ts` and the e2e helpers that seed `seenRules: true` seed `seenTutorial: true` instead. A dedicated spec covers the tutorial itself (§10).

## 8. Theme and palette

### 8.1 Theme tokens

Today `index.css` hard-codes `background: #fff` and components use literal Tailwind colors (`stone-800`, `border-stone-300`, `text-white`). The theme work introduces **semantic tokens** and migrates the chrome to them:

```css
@theme {
  --color-surface: ...;      /* page and dialog background */
  --color-ink: ...;          /* primary text */
  --color-ink-muted: ...;
  --color-line: ...;         /* borders, dividers */
  --color-accent: ...;       /* primary button background */
  --color-on-accent: ...;
  --color-focus: ...;
}
:root[data-theme="dark"] { --color-surface: ...; /* … */ }
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

- **The board is theme-independent.** Region colors, the dark glyph (`GLYPH_COLOR`), the wrong ✕ and the thick region borders keep their light-theme values in dark mode. The M3 contrast guarantees (glyph ≥ 3:1 on every region) were chosen against these exact pastels, and re-deriving 11 distinguishable dark region colors with new glyph colors is a second palette project for little gain: a bright board on a dark frame is a normal look for puzzle games. (If playtesting disagrees, §12 Q4.)
- `settings.theme === "system"` follows `prefers-color-scheme`; `light`/`dark` override it. `src/app/theme.ts` has a pure `resolveTheme(setting, prefersDark)` and `applyTheme` which sets `data-theme` on `<html>` and keeps it in sync via a `matchMedia` listener.
- **No flash:** `index.html` gets a tiny inline script that reads the theme from `localStorage` (`doku:settings`) and sets `data-theme` before first paint, plus `<meta name="color-scheme" content="light dark">`. On Tauri the persisted settings live in the store plugin, not `localStorage`, so the first frame follows the OS and is corrected after hydrate; this is acceptable for a personal app and noted for the manual pass. `theme-color` meta is set from the resolved theme for mobile browsers and the iOS status bar (verify on device).
- Desktop window chrome follows the OS by default. Syncing it to an in-app override needs `setTheme` on the Tauri window, which needs a capability grant; deferred unless it looks wrong in the manual pass (§12 Q5).

### 8.2 Region palette as data

`palette.ts` currently exports Tailwind class names tied to the `--color-region-N` tokens. It becomes a function of the settings so the swap stays "one file":

```ts
export type PaletteName = "default" | "accessible";
export function regionClass(palette: PaletteName, region: number): string; // "bg-region-3" or "bg-region-a-3"
```

`index.css` defines both token sets (`--color-region-*` and `--color-region-a-*`). The class names remain literals in the lookup arrays so Tailwind still emits them (`BOARD_DESIGN.md` §4.4). `Board` reads `palette` and `patterns` once and passes them down; `Cell` gets two primitives, so a settings change re-renders the board once.

### 8.3 Accessible palette

The default 11-color palette cannot be made color-blind-safe by hue alone: reliable categorical palettes top out around 8 colors (Okabe–Ito is 8). So the design is two layers:

1. **`accessible` palette:** Okabe–Ito-derived hues plus lightness variants to reach 11, chosen so that under simulated deuteranopia, protanopia and tritanopia no two **adjacent-capable** colors fall below a ΔE threshold, and the glyph still reaches 3:1.
2. **Patterns (§8.4)** carry the identity that color cannot, so even where two accessible colors look similar to a given player, their patterns differ.

Test (node, extending `palette.test.ts`): for both palettes, glyph contrast ≥ 3:1 on every region; for the accessible palette, pairwise ΔE (CIEDE2000 on the simulated color) ≥ a threshold for every pair that differs in pattern *and* a lower floor for all pairs. The thresholds are chosen empirically when the palette is built and recorded in the test, not guessed here (§12 Q2). Simulation matrices for the three deficiencies are plain constants in the test file.

### 8.4 Patterns

`patterns.ts` maps region index → one of 11 distinct fills: solid, dots, horizontal lines, vertical lines, diagonal `/`, diagonal `\`, grid, crosshatch, checker, zigzag, rings. Implemented as CSS `background-image` layers on the cell using inline SVG data URIs (strokes in a dark tint at ~25 % alpha so the glyph remains the highest-contrast thing on the cell), sized in `em` of `--cell` so they scale with the board. With `patterns` off, nothing is applied. The pattern is decoration: cell `aria-label` already names the region, and `aria-hidden` is not needed since it is CSS.

The pattern index is the region index, so regions keep their pattern for the whole level. (Assigning patterns by region-adjacency to maximize difference is possible but unnecessary: all 11 are distinct.)

## 9. Accessibility pass

### 9.1 Click-only placement (#57)

`inputMode: "mark" | "face"`. A toggle button in the `ActionBar` ("Tap: ✕" ↔ "Tap: Face", `aria-pressed`, ≥ 44 px) and the same switch in Settings ("Tap places faces").

- `"mark"` (default): exactly today's behaviour. Click and Enter toggle ✕, hold places a face.
- `"face"`: click, tap, and Enter/Space on a focused cell call `placeFace` directly (no hold, no 250 ms delay). Holding still works and is not required. `x` still toggles a ✕, so notes are reachable from the keyboard in either mode. Because a placement is irreversible and costs a heart when wrong, the mode is always visible (the toggle shows its state, and a pressed state announces through `aria-pressed`) and persists; it never auto-enables.
- Implementation: `Cell` takes `inputMode` and branches in its single `onClick`/key handler (`mark` → `toggleMark`, `face` → `onPlaceFace`); the hold machinery is unchanged and unused in `face` mode (it is still armed so a hold cannot double-place: `swallowClick` already guards click-after-hold).
- Keyboard shortcut: `f` toggles the mode (plain key only, same guards as `h`). Added to the Rules cheat sheet.
- Closes #57, including its three scenarios (placing without a hold, safe default, mode announced).

### 9.2 Screen-reader announcements

`<Announcer>` is a visually hidden `role="status"` (`aria-live="polite"`, `aria-atomic="true"`) region mounted in `GameScreen`. A pure `announce(outcome, ctx): string` builds the text and `useFeedback` writes it to the announcer:

| Outcome | Text (draft) |
|---|---|
| place | "Face placed, row 3, column 5. 4 of 8 placed." |
| wrong | "Not there. Row 3, column 5 is wrong. 2 hearts left." |
| win | "Solved in 1 minute 23 seconds." (with "New best" when it is) |
| lose | "Out of hearts. Retry is available." |
| inputMode change | "Tapping now places faces." / "Tapping now marks cells." |

Also announced: pause/resume, level start ("Level 3 of 20, 9 by 9"), and the tutorial's `onWrong` text. The announcer clears itself 1 s later so repeats of identical text re-announce (set to empty, then the text, one frame apart).

Cell labels (`Row 3, column 5, emerald region, face`) already exist. Added: the word "conflict" when `isConflict`, and "hint" is not needed since a hint places a face.

### 9.3 Contrast, focus, targets

- **Chrome contrast** in both themes: text ≥ 4.5:1, borders and focus ring ≥ 3:1. A node test computes the ratio for each semantic-token pair (the same approach as `palette.test.ts`), so a token edit that breaks contrast fails CI.
- Focus ring: the board already has a visible ring; extend a single `:focus-visible` style to every button and the switches using `--color-focus`.
- Touch targets: the audit of every interactive element is ≥ 44 px (M3 did the action bar; Settings rows and the tutorial card are new).
- Text scaling: layout must survive the OS/browser font size at 200 % and page zoom to 200 %; the board is container-sized so it is not affected, the header and dialogs wrap rather than clip. Checked in the manual pass and with one Playwright spec at a 200 % device-scale emulation (§10).
- `<html lang="en">` already set; the document `<title>` is "Doku" always (fine); the page `h1` is the level name via `TopBar`.

### 9.4 Hint presentation (conditional on M5)

`DESIGN.md` §7 plans a `<HintToast>` (highlight the cell and explain the technique). M5-07 changes `nextHint` to `{ cell, technique, explanation }` but its stories do not include UI. If M5 ships first, polish adds: the hinted cell gets the `place` effect plus a 2-second ring, and a toast near the action bar shows `explanation` (also sent to the announcer). If M5 slips, this story is skipped and the stub hint stays; the rest of the milestone has no dependency on it. (§12 Q1.)

## 10. Testing

Strict TDD (CLAUDE.md): each row below is written first. Audio and real animation are not observable in jsdom, so the design pushes logic into pure functions and tests the thin shells with fakes.

| Kind | What |
|---|---|
| `outcomeFor` (node) | The existing `feedbackFor` table, ported, plus `cell` is the changed index for place, wrong and hint; `faces` and `hearts` are the after-values; restore and non-`playing` give null. |
| `cueFor` (node) | Each kind returns notes with finite frequencies and durations, gains in `(0, 0.5]`, `at ≥ 0`; `place` pitch is strictly increasing in `faces` across `1..size`; win ends higher than it starts; wrong is lower than every place note. |
| `sound` adapter (node) | With a fake `AudioContext` recording calls: no sound before `unlock`; `play` schedules one oscillator per note with a ramp to 0; the 5th simultaneous voice stops the oldest; `suspend`/`resume` forward; a throwing context is logged and `play` still resolves; `createContext` returning null is a silent no-op. |
| Settings (node) | `parseSettings` for every new field: wrong types and unknown enum values fall back; extras dropped; the old `seenRules` key is ignored. |
| `announce` (node) | Text table above, singular/plural ("1 heart left"), minutes/seconds formatting. |
| `resolveTheme` (node) | `system` follows `prefersDark`; explicit settings win. |
| Palette and tokens (node) | Glyph ≥ 3:1 on all regions, both palettes; accessible palette ΔE floors under three simulations; every chrome token pair meets 4.5:1 / 3:1 in both themes; `regionClass` returns a class that exists in `index.css` for all 11 regions. |
| Patterns (node) | 11 distinct patterns; each is a valid data URI; none is applied when `patterns` is off. |
| Tutorial data (node) | Every step's `level` has `countSolutions === 1`; `goal` cells agree with `solution`; `start` boards contain no conflicts; every `onWrong` is non-empty. |
| `useFeedback` (jsdom) | With fake timers, a placed face calls haptics, sound and `fxStore` once each and writes the announcer text; each respects its own setting independently (`haptics: false` mutes only haptics); a restore triggers none of them; a level change clears `fxStore`. |
| Board/Cell (jsdom) | `fx` reaches exactly the matching cell (others' props are referentially equal, via the existing render-count harness `GameScreen.renders.test.tsx`); `inputMode: "face"`: click, Enter and Space call `placeFace` once, `x` still marks, hold does not double-place; `"mark"` unchanged. `patterns` toggles the pattern style. |
| ResultModal delay (jsdom) | With fake timers the modal is absent for `WIN_DELAY_MS`, then present; a key press skips it; with `prefers-reduced-motion` mocked it opens immediately; progress is recorded before the modal opens. |
| Tutorial (jsdom) | Completing each step's `goal` advances; a rule-breaking action shows `onWrong` and resets the step; Skip and Finish both set `seenTutorial`; the campaign store and `doku:save` are untouched throughout. |
| SettingsDialog (jsdom) | Each new control flips its setting; Theme radiogroup is keyboard operable; Haptics row absent when the adapter is a no-op. |
| E2E (Playwright) | `tutorial.spec.ts`: a fresh profile (seeding `seenTutorial: false`) completes the tutorial with pointer and with keyboard and lands on level 1 paused. `a11y.spec.ts`: `@axe-core/playwright` reports no serious or critical violations on the board, the Pause dialog, Settings, the result modal and the tutorial, in light and dark. `inputmode.spec.ts`: a level won using only `click()` in face mode. `theme.spec.ts`: dark persists across a reload and the board cell backgrounds are unchanged. `zoom.spec.ts`: 200 % device scale, nothing clips, the board stays inside the viewport. Existing specs: `seenRules` seeding replaced, the rest unaffected. |
| Mobile projects | `inputmode` and `tutorial` also run on `mobile-chromium` and `mobile-webkit` with touch helpers. |

**New dev dependency:** `@axe-core/playwright`. No runtime dependencies are added by the milestone.

Animation and sound *quality* are judged by playing (§11), not by assertions; the tests prove they fire at the right time, once, and are silenced by their setting.

## 11. Manual verification (cannot run in CI)

- **Desktop (`bun tauri dev` and a release build):** sound plays on first interaction and not before; backgrounding the window silences it; dark theme follows the OS and the in-app override; window chrome vs dark theme looks acceptable; VoiceOver (macOS) reads cell labels and the announcer text on a full level; keyboard-only run through the tutorial.
- **iOS (simulator and device):** sound muted by the ringer switch (the §5.2 assumption); sound unlocks on the first tap; VoiceOver reads the board and announcements; Dynamic Type at the largest size; reduce-motion and increase-contrast OS settings; dark mode and status bar; haptics and sound together do not feel doubled (§12 Q6).
- **Android:** all of the above once #64 lands.
- **Color blindness:** play three levels with the accessible palette and patterns, and look at screenshots through a deficiency simulator, comparing against the default palette.

## 12. Open questions

1. **Hint UI ownership (§9.4).** Does the highlight-and-explain toast belong in M5-07 or here? Proposal: here, conditional on M5-07 returning the object form. If M5-07 is expanded to include it, drop that story.
2. **Accessible palette thresholds.** The ΔE floors are set when the palette is tuned, from simulated renderings, not decided in advance.
3. **Reduced-motion switch.** Only the OS preference is honoured. Add an in-app "Reduce motion" setting only if someone needs animations off on a platform whose OS flag is not reachable (older WebViews).
4. **Dark board.** The board is the same in both themes (§8.1). If a bright board in a dark frame is jarring in play, a dark region palette is a follow-up with its own glyph/contrast pass.
5. **Window theme sync.** Whether to grant `setTheme` so the native title bar follows the in-app override, or leave it following the OS.
6. **Haptics + sound overlap.** On a phone both fire on every outcome. Proposal: keep both on by default; if that is too much in play, make sound default off on mobile only. Decide by playing on a device.
7. **Tutorial length.** Six steps is a guess; cut to the first three plus hearts if testers find it long. Copy is edited in review.
8. **Win celebration.** The row wave is the cheapest satisfying effect; confetti or a screen-wide burst is possible with CSS and is not planned.
9. **Daily puzzle.** Out of scope here (§1). If it returns, it needs a place in the UI first, which is a decision about reversing `DESIGN.md` §13.13, not polish.

## 13. Suggested issue breakdown (milestone "polish")

Titled `M6-NN`, each strictly TDD, each plannable with `/doku-plan`. Order is by value and dependency; stories 01 to 03 are the shared plumbing the rest hang from.

| # | Story | Delivers |
|---|---|---|
| 01 | One outcome function | `outcomeFor` replaces `feedbackFor`; `useFeedback` replaces the inline effect; `HapticKind` becomes `OutcomeKind`; behaviour unchanged |
| 02 | Settings foundation | the new `Settings` fields and parse; `<SwitchRow>`; sectioned, scrollable Settings dialog; Haptics row hidden where no-op |
| 03 | Sound | `cues.ts`, `sound.ts`, unlock/suspend, `sound` switch; wired in `useFeedback` |
| 04 | Cell and heart animations | `fxStore`, place and wrong effects, heart pop, reduced-motion rules, `Dialog` open transition |
| 05 | Win and loss sequence | wave, `useDelayedStatus`, skip, result modal delay |
| 06 | Click-only placement (#57) | `inputMode`, ActionBar toggle, `f` shortcut, Settings switch, Rules cheat-sheet row |
| 07 | Announcer | `announce`, `<Announcer>`, level/pause/mode announcements, "conflict" in labels |
| 08 | Patterns and accessible palette | `patterns.ts`, accessible tokens, `regionClass`, palette tests with CVD simulation |
| 09 | Theme | semantic tokens migration, `data-theme`, no-flash script, `resolveTheme`, Theme control, contrast test |
| 10 | Interactive tutorial | `steps.ts`, `<Tutorial>`, private store, `ActionBar` store prop, `seenTutorial`, Pause → Replay |
| 11 | Hint presentation | highlight and explanation toast (only if M5-07 has landed) |
| 12 | Accessibility e2e and audit | `@axe-core/playwright` specs, 200 % zoom spec, touch-target audit, focus-ring unification, fixes |
| 13 | Docs sync | `DESIGN.md` §7, §8, §12, §13 (and the daily-puzzle line), `APP_DESIGN.md` §1, §6, §7, `BOARD_DESIGN.md` §4.4, `MOBILE_DESIGN.md` non-goals, README |

**Cut line if time is short:** 01 to 07 and 10 are the milestone; 08 and 09 next; 11 is optional; 12 must run before the milestone is called done, on whatever has shipped.

## 14. Decisions

1. **One outcome function feeds every channel.** Haptics, sound, animation and announcements cannot disagree.
2. **No store or engine changes.** Polish is subscribers and presentation; saves and the pure-store rule (`APP_DESIGN.md` decision 8) are untouched.
3. **Synthesized audio, no assets.** Original, offline, zero bundle weight; pitch rises with progress.
4. **Only outcomes make sound or buzz.** The free ✕, undo and redo stay silent (extends `DESIGN.md` §13.10).
5. **CSS-only animation on `transform`/`opacity`, honouring `prefers-reduced-motion`;** the only deliberate delays are the result modal's, skippable.
6. **The board looks the same in both themes;** only the chrome is themed.
7. **Color-blind support is two layers:** an accessible palette and patterns, because 11 hues cannot be reliably separated by color alone.
8. **The tutorial runs on a private store and the real components,** so it cannot affect the campaign and cannot drift from the real UI.
9. **Click-only placement is an explicit, persisted, visible mode,** defaulting to the safe hold gesture.
10. **Daily puzzle stays out,** per `DESIGN.md` §13.13; the §12 line is corrected in the docs sync.
