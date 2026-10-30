# Doku

A Tauri 2 + React + TypeScript region-placement logic puzzle: place one smiley face per colored region, row and column, with no two faces touching. Desktop first, mobile later.

## Docs

- [`DESIGN.md`](DESIGN.md): component-level design, milestones, decisions.
- [`docs/ENGINE_DESIGN.md`](docs/ENGINE_DESIGN.md): low-level engine design (data structures, algorithms, tests, build order).
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
bun run test        # Vitest (node environment)
```

No lint script exists yet. The design also calls for Playwright (against the Vite build); add it when introducing it.

Recommended IDE setup: [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
