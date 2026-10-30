# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Doku is a Tauri 2 + React + TypeScript puzzle game. The repo is currently the Tauri scaffold plus design docs; the engine (GitHub milestone "engine", issues #5–#18) is not yet implemented.

## Where things are documented

Read these before building, and update them (not this file) when a decision changes. Do not restate their content here.

- `README.md`: build/run commands (Bun) and the docs index.
- `DESIGN.md`: architecture, layering, milestones, decisions. Notably §2 (pure-TS engine, thin Rust shell), §4 (wrong tap = deviation from the unique solution) and §13 (decisions).
- `docs/ENGINE_DESIGN.md`: engine internals. Takes precedence over `DESIGN.md` on low-level detail; keep the two in sync.
- GitHub issues in the "engine" milestone: milestone 1 user stories, titled `M1-NN: ...`.

## Conventions

- **Strict TDD:** write a failing test first, then the minimum code to pass, then refactor. No production code without a test that demanded it.
- **Fearless refactoring:** this is a personal project. Until the first MVP release there is no backwards compatibility, no deprecation shims, and no saved-data versioning or migrations. Change the shape of code, types, and saved data directly and update all callers.
- **Planning:** use `/doku-plan` to plan an issue before implementing it. It drafts a plan, reviews it with the user in `ptal`, and posts it to the issue.
- Branch off `main` and open PRs; commits and PRs use the attribution lines from the session reminder.
- All branding, names and art are original; do not reference any specific existing game.
