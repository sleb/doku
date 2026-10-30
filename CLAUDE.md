# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Doku is a Tauri 2 + React + TypeScript puzzle game (N×N region-placement puzzle, one smiley face per region/row/column, no touching, 3 hearts). The repo is currently the Tauri scaffold plus design docs; the engine (milestone 1, GitHub milestone "engine", issues #5–#18) is not yet implemented. `DESIGN.md` and `docs/` describe the target, so check them before building anything and update them when a decision changes.

- `DESIGN.md`: component-level design, milestones (§12), decisions (§13).
- `docs/ENGINE_DESIGN.md`: low-level engine design (data structures, algorithms, tests, build order). Takes precedence over `DESIGN.md` where they differ in detail; keep the two in sync.
- `docs/USER_STORIES_M1.md`: milestone 1 stories; each is a GitHub issue titled `M1-NN: ...`.

## Commands

Package manager is Bun (`bun.lock`).

- `bun install`
- `bun run dev`: Vite dev server only (the engine and UI should be runnable in a plain browser).
- `bun run tauri dev`: full desktop app.
- `bun run build`: `tsc && vite build`.
- No test or lint scripts exist yet. The design calls for Vitest (engine/store/components) and Playwright (against the Vite build); add the scripts when introducing them.

## Architecture (the parts that span files)

- **Game logic is pure TypeScript in `src/engine`, not Rust.** It must have zero imports from UI, store, platform, or `@tauri-apps/*`, and runs under Vitest with no Tauri or DOM. The Rust shell (`src-tauri`) stays thin: storage and native features only, no custom `#[tauri::command]` until a native need appears.
- **Engine functions are pure:** take a board, return new data, never mutate inputs (this is what makes undo/redo trivial).
- **Layering:** UI components → game store (state machine `idle → playing ⇄ paused → won | lost`) → engine; persistence goes through a `src/platform` adapter (Tauri store vs. localStorage) so UI code is platform-agnostic.
- **A wrong tap means deviating from the level's unique stored solution** (`judgeTap` in `rules.ts`), not breaking a rule. A wrong face is never placed; the cell is auto-marked ✕ and a heart is spent. Marks never cost hearts. Rule conflicts (`findConflicts`) are for highlighting only. Consequence: every level must have exactly one solution (`countSolutions == 1`), and `Level.solution[r]` (column of the face in row r) must be verified against the rules in dev/test builds.
- **Two independent solvers** in `solver.ts`: a backtracker (`solve`, `countSolutions`) that proves uniqueness, and a human-style technique-ladder solver (`solveByTechniques`) that drives difficulty rating and hints. The technique ladder in `techniques.ts` is the single source of truth for tier assignment and hint text.
- Levels are generated offline (`tools/`), bundled as JSON, and the generator is seeded so daily puzzles are deterministic across devices.

## Conventions

- Branch off `main` and open PRs; commits and PRs use the attribution lines from the session reminder.
- All branding, names and art are original; do not reference any specific existing game.
