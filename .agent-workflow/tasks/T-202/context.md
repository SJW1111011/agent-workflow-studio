# T-202 Context

## Why now

T-200 (Lite Mode) and T-201 (`done`) reduce file ceremony, but users still have to manually supply `--proof-path` and `--status` flags. For the "30-second task record" goal, flags must be optional with smart defaults. Git diff and test exit code are the two most reliable signals available in any repo.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `src/lib/smart-defaults.js` now owns proof-path inference, opt-in test-status inference, and the user-facing fallback messages for non-git / no-test-script cases.
- `src/lib/repository-snapshot.js` now exposes a lightweight changed-file query and only treats the workspace as git-backed when the workspace root is the repository root, which avoids nested temp workspaces accidentally inheriting the parent repo diff.
- `src/lib/task-service.js`, `src/lib/done.js`, and `src/cli.js` now preserve explicit `--proof-path`, `--check`, and `--status` values while filling omitted proof paths from git and opt-in test results from `--infer-test`.
- `test/smart-defaults.test.js` covers git diff parsing, no-git fallback, npm test pass/fail detection, zero-flag `done`, override precedence, and the no-test-script info path.
- Verification passed with the focused acceptance slice, the full `npm test` suite, and `npm run lint`.

## Open questions

- None at handoff. This task kept test inference opt-in behind `--infer-test` and used the current working tree diff plus untracked files for proof-path inference within the workspace-root git repo.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-201 (`done` command must exist for smart defaults to plug into)
- Must not slow down `run:add` / `done` when git is available 鈥?`git diff --name-only` is fast
- Must gracefully degrade in non-git repos
- No runtime dependencies
