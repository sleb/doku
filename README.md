# Doku

A Tauri 2 + React + TypeScript region-placement logic puzzle: place one smiley face per colored region, row and column, with no two faces touching. Desktop first, mobile later.

## Docs

- [`DESIGN.md`](DESIGN.md): component-level design, milestones, decisions.
- [`docs/ENGINE_DESIGN.md`](docs/ENGINE_DESIGN.md): low-level engine design (data structures, algorithms, tests, build order).
- [`docs/BOARD_DESIGN.md`](docs/BOARD_DESIGN.md): low-level design for the milestone 2 playable board (store, Board/Cell, HUD, result modal, tests).
- Milestone 1 user stories are GitHub issues in the "engine" milestone.

## Development

Uses [Bun](https://bun.sh).

```sh
bun install
bun run dev         # Vite dev server only (engine and UI run in a plain browser)
bun run tauri dev   # full desktop app
bun run build       # tsc && vite build
```

```sh
bun run test        # Vitest: `node` project (`src/**/*.test.ts`) and `dom` project (`src/**/*.test.tsx`, jsdom, React Testing Library)
bun run test:engine # engine tests only, plus the engine import-boundary test
bun run test:e2e    # Playwright (Chromium) against the Vite dev server on port 1420
```

## Quality gates

CI (`.github/workflows/ci.yml`) runs on every PR and every push to `main`. All of these must pass:

| Gate | Command |
| --- | --- |
| Biome lint, format and import order | `bun run lint` (`bunx biome check --write .` fixes) |
| TypeScript typecheck (strict, no unused locals/params) | `bun run typecheck` |
| Unit tests | `bun run test` |
| Playwright e2e (own CI job) | `bun run test:e2e` (first run: `bunx playwright install chromium`) |
| Production build | `bun run build` |
| Rust formatting | `cargo fmt --check` (in `src-tauri/`) |
| Rust lints, warnings denied | `cargo clippy --all-targets -- -D warnings` (in `src-tauri/`) |
| Rust tests | `cargo test` (in `src-tauri/`) |

`bun run check` runs the web gates locally. Biome covers `src/` and root TS/JSON config. `bun run check` does not run Playwright (it needs browser binaries); CI runs `test:e2e` as a separate job. Not yet gated: coverage thresholds.

Recommended IDE setup: [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
