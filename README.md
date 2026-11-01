# Doku

A Tauri 2 + React + TypeScript region-placement logic puzzle: place one smiley face per colored region, row and column, with no two faces touching. Desktop first; the responsive layout, web-view hardening and a haptics seam for mobile have landed, while the native iOS and Android builds are still pending.

## Docs

- [`DESIGN.md`](DESIGN.md): component-level design, milestones, decisions.
- [`docs/ENGINE_DESIGN.md`](docs/ENGINE_DESIGN.md): low-level engine design (data structures, algorithms, tests, build order).
- [`docs/BOARD_DESIGN.md`](docs/BOARD_DESIGN.md): low-level design for the milestone 2 playable board (store, Board/Cell, HUD, result modal, tests).
- [`docs/MOBILE_DESIGN.md`](docs/MOBILE_DESIGN.md): low-level design for milestone 3 (responsive layout, haptics, Android and iOS builds).
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
bun run test:e2e    # Playwright (Chromium, mobile Chromium, mobile WebKit) against the Vite dev server on port 1420
```

## Quality gates

CI (`.github/workflows/ci.yml`) runs on every PR and every push to `main`. All of these must pass:

| Gate | Command |
| --- | --- |
| Biome lint, format and import order | `bun run lint` (`bunx biome check --write .` fixes) |
| TypeScript typecheck (strict, no unused locals/params) | `bun run typecheck` |
| Unit tests | `bun run test` |
| Playwright e2e (own CI job) | `bun run test:e2e` (first run: `bunx playwright install chromium webkit`) |
| Production build | `bun run build` |
| Rust formatting | `cargo fmt --check` (in `src-tauri/`) |
| Rust lints, warnings denied | `cargo clippy --all-targets -- -D warnings` (in `src-tauri/`) |
| Rust tests | `cargo test` (in `src-tauri/`) |

`bun run check` runs the web gates locally. Biome covers `src/` and root TS/JSON config. `bun run check` does not run Playwright (it needs browser binaries); CI runs `test:e2e` as a separate job. Not yet gated: coverage thresholds.

### Mobile (pending #63/#64, unverified)

No native projects exist yet: `src-tauri/gen/` holds only generated schemas, so the commands below will not work until #63 (iOS) and #64 (Android) land. Planned, from `docs/MOBILE_DESIGN.md` §7:

```sh
bun tauri ios init && bun tauri ios dev          # iOS first
bun tauri android init && bun tauri android dev
```

Prerequisites: Xcode and `rustup target add aarch64-apple-ios aarch64-apple-ios-sim` (plus `x86_64-apple-ios` for an Intel simulator) for iOS; Android Studio SDK and NDK, JDK 17, `ANDROID_HOME`/`JAVA_HOME` and the Android Rust targets for Android. `vite.config.ts` honors `TAURI_DEV_HOST` so a device can reach the dev server on port 1420.

Recommended IDE setup: [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
