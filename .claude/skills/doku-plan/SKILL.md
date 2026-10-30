---
name: doku-plan
description: Create an execution plan for a Doku GitHub issue, review it with the user in ptal, then publish it as a comment on the issue. Use when the user runs /doku-plan or asks to plan an issue or the next story in the "engine" milestone.
argument-hint: "[issue number]"
---

# doku-plan

Plan one GitHub issue: draft a plan file, review it with the user in `ptal`, then post it to the issue. Plan only; do not implement.

## 1. Pick the issue

- If an issue number was given, use it.
- Otherwise list the open issues in the milestone and take the lowest-numbered one that is not already planned:
  `gh issue list --milestone engine --state open --json number,title --limit 50`
  An issue is planned if it has a comment starting with `## Execution plan` (`gh issue view <n> --comments`). Say which issue you picked and why.
- Read the issue: `gh issue view <n>`.

## 2. Gather context

Read before planning, and do not restate their content in the plan beyond what the steps need:

- `CLAUDE.md` conventions (strict TDD, fearless refactoring, branch off `main`).
- `DESIGN.md` and `docs/ENGINE_DESIGN.md` for the parts the issue touches. `ENGINE_DESIGN.md` wins on low-level detail; §12 gives the build order.
- The current code under `src/` and what earlier issues already landed (`git log`, existing tests). Do not plan work that already exists.
- Test tooling that exists now (`package.json` scripts), so the plan does not assume tools that are missing.

## 3. Write the plan file

Write `<scratchpad>/m1-NN-plan.md`, where `NN` matches the issue's `M1-NN` title prefix (fall back to `issue-<n>-plan.md`). Use the scratchpad directory, never `/tmp` or the repo. Always use the full absolute path in messages and commands.

Use this structure, keeping it short and specific to the issue:

```
# Execution plan: <issue title> (#<n>)

**Story:** one or two sentences restating what must be true when done.

## Starting state
What exists, what is missing, anything that constrains the work.

## Design decisions
Where the story, design docs, and code disagree or leave a choice open: a table or short list with the chosen option. Put any real open question to the user here.

## Steps (strict TDD)
Numbered, in order: branch name, tooling, failing test (red) with what it asserts, the minimum code (green), refactor and verify (test, `bun run build`), docs to update, PR (closes #<n>). Name the files.

## Out of scope
What is deliberately left to other issues, with their numbers.

## Risks
Only real ones.
```

Rules for the content:

- Follow the TDD order: no production code step without a preceding failing test.
- Per CLAUDE.md, no compat shims, migrations, or aliases; plan direct changes and update all callers and docs.
- Do not pull in helpers or modules that no test in this issue demands.
- Docs that change go in the plan as a step: update `docs/ENGINE_DESIGN.md` and `DESIGN.md` together, not `CLAUDE.md`.
- Do not reference any specific existing game.

## 4. Review with ptal

1. Open the review for the user in a pane beside you (herdr is the multiplexer):
   `herdr pane split --current --direction right`, then
   `herdr pane run <new pane id> "exec ptal '<absolute plan path>'"`.
   If herdr is unavailable, ask the user to run `ptal <absolute plan path>` themselves.
2. Run `ptal wait '<path>' --timeout 300` in the background and keep going only when it reports `turn` or `closed`. On `timeout`, wait again.
3. On `turn`: run `ptal comments '<path>'`, edit the plan to address each thread, re-run `ptal comments` to check for outdated threads, then `ptal reply ... --as claude`, `ptal resolve ... --as claude --note "..."`, and `ptal handoff '<path>' --as claude --note "..."`. Wait again. Disagree with a comment in the reply when you have a reason; do not just comply.
4. On `closed`: if the verdict is `approved`, continue; if `dropped`, stop and tell the user. Read the close note: it may carry extra instructions.
5. Close the ptal pane you opened if it is still open.

Use the same `--as claude` name every time.

## 5. Publish to the issue

Only after the review is approved. Write `<scratchpad>/comment.md` as `## Execution plan`, a blank line, then the plan file without its H1 title, and post it:

`gh issue comment <n> --body-file <scratchpad>/comment.md`

This is an outward-facing write. If the permission check blocks it, do not work around it with other tools; ask the user to run the command with `!`. Post as a comment, not an edit of the issue body, which holds the acceptance criteria. Report the comment URL.

Then stop. Do not start implementing unless the user asks.
