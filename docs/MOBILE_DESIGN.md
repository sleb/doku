# Doku: Milestone 3 low-level design (mobile)

Companion to `DESIGN.md` §8, §9 and §12 for milestone 3 ("Mobile"). It covers touch hardening of the existing hold gesture, the responsive layout, mobile web-view hardening and safe areas, haptics, and the iOS and Android builds. The engine, the store and the board's gesture code (`docs/ENGINE_DESIGN.md`, `docs/BOARD_DESIGN.md`) are consumed as-is except where §3 says otherwise. Where this document and `DESIGN.md` disagree, this one wins until `DESIGN.md` is synced (§11).

**Status:** M3-01 to M3-04 have landed (responsive layout, web-view hardening, mobile Playwright projects, haptics seam). M3-05 (iOS) and M3-06 (Android) are pending (#63/#64), so every native item in §7 and the device pass in §8 are still planned. M3-07 (#65) is a partial doc sync; `DESIGN.md` §7 to §9 and §13 and `README.md` are synced, and the native items get recorded after #63/#64.

## 1. Goals and non-goals

**Goal:** the existing single-level game is installable and comfortably playable on a phone: iOS first, then Android (decision 6). "Playable" means an 11×11 board fits any phone viewport with no scrolling, the existing hold-to-place gesture (250 ms delay, 500 ms glow) works unchanged under a finger, and a win or a wrong tap is felt as well as seen.

**Non-goals (still later milestones):** level select, persistence and resume-after-kill (M4: backgrounding keeps the WebView alive and a dead app loses one level, which is acceptable until saves exist), undo/redo, hints, timer, settings screen, sound, store release (signing, TestFlight, Play Console), color-blind palette. Wrong-tap animation stays M6.

## 2. What exists and what mobile breaks

| Today | Problem on a phone |
|---|---|
| Face placed only by a 750 ms hold (`useHold`); tap toggles ✕ | Kept as is on mobile (decision 1). Risks to verify on device: the finger covers the glow, and drag-off cancels with no slack (§10 question 2) |
| `--cell` budget `100vw - 2rem`, `100dvh - 9rem` | Magic numbers; ignores safe areas and any extra bars; 11×11 on a 375 pt wide screen is about 30 pt per cell (below the 44 pt HIG and 48 dp Material targets) |
| `<main class="w-fit px-4 py-6">`, no viewport-fit, no overscroll rules | Rubber-band scroll, pull-to-refresh, double-tap zoom, content under the notch |
| No `src/platform/`, no native projects | No haptics seam, no `gen/android` or `gen/apple` |
| Rust shell has only the opener plugin and a leftover `greet` command | Needs the haptics plugin and a mobile-only capability file |

The 30 pt cells cannot be fixed by layout alone (the grid is N columns wide on a fixed-width screen). The existing input already makes a mis-tap cheap: a tap only toggles a free ✕ (never costs a heart), and a face needs a deliberate 750 ms hold.

## 3. Input: unchanged

Mobile keeps the desktop gesture exactly: tap toggles a ✕, press and hold places a face (250 ms of nothing, then the 500 ms border glow, `docs/BOARD_DESIGN.md` §4.3). There is no tool toggle and no mobile-specific gesture. `useHold`, `CellView` and the glow are not changed by this milestone except for tuning found on a device (§10 question 2).

The work here is only verification, since #55 was never run on a touch device:
- Touch capture release, so drag-off cancels the hold.
- No text selection or callout on long-press (`.cell` rules).
- The glow stays visible beside a fingertip and paints correctly in WKWebView (the stroke/`pathLength` concern in `BOARD_DESIGN.md` §4.3).
- The hold does not conflict with Android's long-press behaviors.

Issue #57 (click-only placement for screen readers and switch control) is an accessibility issue, independent of mobile, and is not part of this milestone.

## 4. Responsive layout

One mechanism, container queries, serves phones in both orientations and the desktop window, so the side panel `DESIGN.md` §8 promised for desktop arrives here without a separate desktop path.

### 4.1 Structure

```
<main class="h-dvh safe-padding [container-type:size]">  app root, fills the viewport, pads by the insets
  <GameLayout>                                    CSS grid, two templates (below)
    header   → <TopBar>  (level id, hearts)
    board    → <Board>   (centered in its cell, sized to fit)
    controls → (empty in M3; undo, redo, hint arrive in M4)
```

- **Tall** (default; container aspect ratio below 1.2): one column, rows `auto 1fr auto` = header, board, controls.
- **Wide** (`@container (min-aspect-ratio: 1.2)`): two columns, `1fr auto`: the board on the left, a panel (header, later controls) on the right. Landscape phones and desktop windows land here.
- The `board` grid area is itself a size container (`container-type: size`, `min-height: 0`), so the board measures the space it is actually given, not the viewport.

### 4.2 Board sizing

Replace the viewport math in `Board.tsx` with the area's own size:

```css
--cell: min(
  calc((100cqw - 8px) / var(--n)),
  calc((100cqh - 8px) / var(--n)),
  4.5rem
);
```

The `8px` is the frame's `border-4` (2 × 4px), as today. `main` carries the safe-area and gutter padding (§5) and `.game-layout` a `0.5rem` gap between areas, so the board needs no knowledge of insets or of the other bars. `4.5rem` stays the desktop cap. `cqw`/`cqh` are supported in WKWebView 16+ and Android System WebView 105+, which is within Tauri 2's mobile minimums (iOS 13 target is the one to check: see §10 question 4).

**Smallest case to design for:** 11×11 at 320×568 (iPhone SE). With 8 px gutters the board is 304 − 8 = 296 px, giving 26 px cells. Tall layouts leave the height for it (header ≈ 48). That is small but legible; the fallback if the device pass finds it unplayable is a pinch/zoom mode, which is explicitly deferred (§10 question 3).

### 4.3 Typography and controls

The header uses `rem`, so system text scaling grows it; the board's glyphs scale with `--cell`. No other mobile-specific styling is needed in M3.

## 5. Web-view hardening and safe areas

All in `index.html` and `app/index.css`; no JS.

- **Viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. `viewport-fit=cover` is what makes `env(safe-area-inset-*)` non-zero on iOS. Zoom is not locked with `user-scalable=no`: the board always fits, and keeping zoom available costs nothing in accessibility.
- **Insets:** `:root` defines `--safe-top/right/bottom/left: max(env(safe-area-inset-X), 0.5rem)` in `app/index.css`. the `.safe-padding` class pads with all four tokens (`main` is border-box, so `h-dvh` is still the full viewport) and the board area has no padding of its own (`.game-layout` supplies a `0.5rem` gap between the board and the header/controls or side column), so the board measures only the space inside the insets. The result modal's overlay is `fixed inset-0` and also uses `.safe-padding`, so the dim covers the inset regions while the dialog clears them. `container-type: size` on `main` is deliberate: it is the layout's size container and makes `main` the overlay's containing block; its padding box is the full viewport, so the overlay still reaches the screen edges. The page background is set on `html` and `body` so the status-bar and home-indicator regions are not white.
- **Android caveat:** Android WebViews report `env()` insets as 0 unless the host window is edge-to-edge and Tauri forwards insets. §7 makes confirming this the first thing done on a device; if insets are 0 the app simply runs below the system bars (the Tauri default), which is acceptable and needs no change.
- **No bounce, refresh, or zoom gestures:** `html, body { overscroll-behavior: none; overflow: hidden; }`, `body { touch-action: manipulation; }` (kills double-tap zoom without blocking pinch). Cells already carry `touch-none select-none` and the callout/tap-highlight rules from #55.
- **Orientation:** not locked. This reverses `DESIGN.md` §8 ("orientation lock to portrait"): §4's layout handles landscape, so a lock would only add per-platform manifest edits and break tablets. Revisit only if the device pass finds landscape unplayable.

## 6. Haptics and the platform seam

### 6.1 `src/platform`

This introduces the adapter layer from `DESIGN.md` §8 for the first time. Only what milestone 3 needs:

```ts
// src/platform/haptics.ts
export type HapticKind = "place" | "wrong" | "win" | "lose";
export interface Haptics { play(kind: HapticKind): Promise<void> }
export function createHaptics(deps?: { isTauri(): boolean; loadPlugin(): Promise<Plugin> }): Haptics;
export const haptics: Haptics;   // createHaptics() with the real deps
```

`createHaptics` takes injectable `isTauri` and `loadPlugin` so the mapping is unit-tested with fakes. The plugin is loaded with `await import("@tauri-apps/plugin-haptics")` inside `play`, so the web build keeps it in a separate, never-fetched chunk. `play` wraps everything in try/catch and always resolves.

Adapters, picked by `isTauri()` (`"__TAURI_INTERNALS__" in window`):

| Where | Implementation |
|---|---|
| Tauri (plugin registered on mobile only, M3-05) | `@tauri-apps/plugin-haptics`: `place` → `impactFeedback("light")`, `wrong` → `notificationFeedback("warning")`, `win` → `notificationFeedback("success")`, `lose` → `notificationFeedback("error")` |
| Tauri on desktop, web, tests | no-op (the plugin is registered only for mobile, and calls are wrapped so a rejected invoke is swallowed) |

`navigator.vibrate` is deliberately not used: WKWebView does not implement it and the Android pattern is a poor match for the semantic kinds. Every call is `void`-ed and its rejection caught: a failed buzz must never break gameplay.

Haptic choices follow the platform guidance that feedback confirms an outcome and should not fire for the free action: `toggleMark` is silent. Only `placeFace` outcomes and the end of the game buzz.

### 6.2 Deriving feedback from the store

The store stays pure. A pure function maps a state change to at most one haptic:

```ts
// src/platform/feedback.ts
export function feedbackFor(prev: GameState, next: GameState): HapticKind | null;
```

- `prev.status === "playing"` and `next.status === "won"` → `"win"`; `"lost"` → `"lose"` (these take precedence over place/wrong, so a winning face buzzes once, not twice).
- Otherwise, hearts decreased → `"wrong"`; the number of faces on the board increased → `"place"`; anything else (mark toggles, restart, no-ops, same state reference) → `null`.

`GameScreen` subscribes once in an effect (`gameStore.subscribe((next, prev) => { const k = feedbackFor(prev, next); if (k) void haptics.play(k) })`) and unsubscribes in the cleanup. The subscription lives in `GameScreen` rather than the store module so tests of the store and of `Board` never trigger side effects, and so it is cleaned up with the screen like the existing reset.

### 6.3 Settings

The `haptics` on/off setting (`DESIGN.md` §5, `settingsStore`) is M4 with the settings screen. Until then haptics are always on; the OS-level system haptics switch (iOS Settings, Android touch feedback) still governs. This is recorded in §10 as a deliberate gap, not an oversight.

## 7. Rust shell and native projects

- **Plugins:** `tauri-plugin-haptics` under `[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]` in `Cargo.toml`, registered in `run()` behind `#[cfg(mobile)]`. `bun add @tauri-apps/plugin-haptics`.
- **Capabilities:** keep `capabilities/default.json` as is. Add `capabilities/mobile.json` with `"platforms": ["android", "iOS"]`, `"windows": ["main"]`, `"permissions": ["haptics:default"]`. A separate file keeps the desktop permission set unchanged and lets the capability schema be checked per platform.
- **Cleanup:** remove the scaffold's `greet` command (nothing calls it). The opener plugin stays (it is the scaffold's and harmless).
- **Native projects:** `bun tauri android init` and `bun tauri ios init` generate `src-tauri/gen/android` and `src-tauri/gen/apple`. Commit them (Tauri's guidance: they hold project config, e.g. permissions and the iOS signing team, that you edit), and add the build outputs (`gen/android/.gradle`, `gen/android/app/build`, `gen/apple/build`, `DerivedData`, `*.xcuserstate`) to `.gitignore`.
- **Android:** `VIBRATE` permission goes in via the plugin's manifest merge; verify it appears in the merged manifest. `minSdk` stays Tauri's default.
- **iOS:** development team through `TAURI_APPLE_DEVELOPMENT_TEAM` or `bundle.iOS.developmentTeam`; no secrets committed. A free Apple ID builds to a personal device and the simulator.
- **Dev loop:** `vite.config.ts` already honors `TAURI_DEV_HOST`, which is what `tauri android dev` and `tauri ios dev` set so the device can reach the dev server on port 1420. The `strictPort` and HMR ports (1420/1421) must be free and the device on the same network.

**This machine today:** Xcode is installed, but only the `aarch64-apple-darwin` Rust target is present (no `aarch64-apple-ios`, `aarch64-apple-ios-sim`, or the Android triples), and `ANDROID_HOME` and `JAVA_HOME` are unset. iOS is first, so M3-05 needs only `rustup target add aarch64-apple-ios aarch64-apple-ios-sim` (plus `x86_64-apple-ios` for an Intel simulator) and a configured Xcode. The Android SDK, NDK, JDK 17 and the Android triples are set up in M3-06.

## 8. Testing (strict TDD, written failing first)

**Unit, node**
- `feedbackFor`: win beats place; loss beats wrong; wrong face → `"wrong"`; correct face → `"place"`; mark toggle, restart, and an identical state → `null`; frozen inputs are not mutated.
- `haptics` adapter selection: with `window.__TAURI_INTERNALS__` absent it is a no-op; with it present and the plugin mocked, each kind maps to the right call; a rejecting plugin does not throw.

**Components, jsdom**
- `GameScreen` (real store): haptics are asserted through a fake `Haptics` swapped in with `vi.mock`: a held correct face plays `place`, a held wrong face `wrong`, a toggle nothing, the winning face only `win`.
- `GameLayout`: renders header and board slots (class-level only; geometry is covered in e2e).

**E2E, Playwright** (`bun run test:e2e`, new projects in `playwright.config.ts`)
- Add `mobile-chromium` (`devices["Pixel 7"]`, touch enabled) and `mobile-webkit` (`devices["iPhone 14"]`). WebKit is the closest stand-in for WKWebView and finally covers the "WebKit is unverified" gap noted in `BOARD_DESIGN.md` §4.3. Existing desktop specs keep running on `chromium` only; the new `e2e/mobile.spec.ts` runs on the mobile projects. Routing is by `testIgnore: /mobile\.spec\.ts/` on `chromium` and `testMatch: /mobile\.spec\.ts/` on both mobile projects; `webview.spec.ts` stays desktop-only. Shared helpers live in `e2e/helpers.ts`. CI installs `chromium webkit`.
- Layout (touch-agnostic, assert geometry): at 375×667 and 320×568, an 11×11 board lies entirely inside the viewport, the document does not scroll (`scrollHeight <= innerHeight`), and no cell is smaller than a recorded floor (22 px, the 320-wide 11×11 case). At 667×375 the wide template applies (controls to the right of the board).
- Touch playthrough: tap a cell → ✕; hold each solution cell with dispatched `PointerEvent`s (`pointerType: "touch"`, via `locator.evaluate`, portable across engines; `page.touchscreen` only taps, so plain taps use `locator.tap()`). Synthetic events skip implicit capture and click synthesis, so the helper sends `pointerup` then `click` explicitly to exercise `swallowClick` → "You solved it"; drag off mid-hold cancels; a tap never shows the glow. Assert state, never fixed timings beyond `HOLD_TOTAL_MS` plus margin, as in `playthrough.spec.ts`.
- Not testable in CI and therefore manual: safe-area insets, haptics, the callout/selection suppression on a real long-press, and Android edge-to-edge.

**Manual device pass** (a checklist in the PR, per `DESIGN.md` §11), run on one Android device or emulator and one iOS simulator/device: 11×11 and 7×7 fit; no scroll, bounce or zoom; insets clear the notch and home indicator; tap and hold both work; a long-press shows no callout or selection; each haptic kind is distinguishable; rotate and the layout switches; kill and relaunch yields a fresh level (expected until M4).

## 9. Issue breakdown

Titled `M3-NN` in a new "mobile" GitHub milestone, each with Gherkin acceptance criteria as in M1/M2. Order is mostly sequential because later work needs the earlier layout; web-only work (01–03) needs no device.

1. **M3-01 Responsive layout:** §4. `GameLayout`, container-query sizing, side panel on wide, removes the viewport-math `--cell`; `main` keeps the safe-area padding (M3-02).
2. **M3-02 Web-view hardening and safe areas:** §5.
3. **M3-03 Mobile Playwright projects and specs:** §8 E2E. Lands with or just after 01/02 so the layout is tested as built.
4. **M3-04 Haptics seam:** §6, with the plugin stubbed (no native project needed: the adapter is a no-op off Tauri-mobile).
5. **M3-05 Native shell + iOS build:** §7, `ios init`, the shared plugin and capability wiring, runs on the simulator and, if available, a device, passes the manual checklist, tunes anything it finds (cell floor, hold slop, §10 question 2). Also confirms `env()` insets and the WKWebView glow rendering.
6. **M3-06 Android build:** `android init`, SDK/NDK/JDK setup, `VIBRATE` in the merged manifest, runs on an emulator or device, repeats the checklist, and checks the Android inset caveat (§5).
7. **M3-07 Docs sync:** §11.

## 10. Open questions

1. **Resolved:** platform order is iOS first, then Android (decision 6).
2. **Hold tolerance on touch.** `useHold` cancels on `pointerleave` with no slack (`BOARD_DESIGN.md` §8.8), which on a 26–30 px cell may cancel a normal, slightly jittery press. Default: leave it and decide from the device pass (M3-05/06); if needed, add a small movement slop for `pointerType === "touch"` (cancel only after more than ~10 px travel) rather than widening the cell.
3. **Zoom or magnifier for dense boards.** If 26 px cells prove too small on the smallest phones, options are a tap-and-hold magnifier or pinch-zoom of the board. Deferred; free ✕ taps and the deliberate hold are the mitigation for now.
4. **Minimum OS versions.** Container-query units need WKWebView/Safari 16 and WebView 105. Default: set the iOS deployment target to 16 and Android `minSdk` as Tauri defaults, and accept that older devices are unsupported rather than adding a `vw`/`dvh` fallback. Confirm when `ios init` shows the generated target.
5. **Haptics setting.** Always on until M4's settings screen (§6.3); say if a mute switch is needed sooner.

## 11. Doc sync checklist (M3-07)

Status: done for everything that landed in M3-01 to M3-04; items marked *pending* wait on #63/#64.

- `DESIGN.md` §8: `input` mobile column becomes "same as desktop: tap = ✕, hold = face" (drop "long-press = mark"); drop the orientation lock; `window` row says "safe-area insets via CSS `env()`". §7: layout (including the desktop side panel) moves to M3; `<InputModeToggle>` is not part of M3 (it stays tied to #57). §9: record the haptics plugin and the mobile capability file (recorded as planned; *pending* the native wiring). §12 unchanged. §13: add the decisions below (done).
- `BOARD_DESIGN.md` §4.2: sizing now comes from the board area (§4.2 here). Done.
- `README.md`: add this document to the docs index, plus the mobile dev commands (`bun tauri android dev`, `bun tauri ios dev`) and the toolchain prerequisites. Done, labeled pending since the native projects do not exist yet.

## 12. Decisions

1. **Input is unchanged on mobile**: tap = ✕, hold with the 250 ms delay and glow = face. No tool toggle; click-only placement is #57, separate.
2. **Container queries for one layout** covering phones (both orientations) and desktop; no orientation lock, no separate desktop layout.
3. **`src/platform/haptics` with a no-op default** and a pure `feedbackFor`, so feedback is testable without a device and the store stays side-effect free.
4. **Haptics only for outcomes** (place, wrong, win, lose), never for the free ✕.
5. **Commit `src-tauri/gen`**, ignoring build outputs.
6. **iOS first, then Android.** This machine already has Xcode and no Android SDK, and iOS is the stricter WebView (WKWebView) for the glow and insets. This reverses the `DESIGN.md` §12 order; the two native issues are independent.
