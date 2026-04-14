# T-202 - Smart defaults 鈥?auto-infer scope from git diff and checks from test exit code

## Goal

When recording evidence via `run:add` or `done`, automatically infer `--proof-path` from `git diff` (changed files) and `--check` / `--status` from the test runner exit code, so users can type just `done T-001 "what I did"` with zero flags and still get meaningful evidence. Manual flags override the inferred values.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/smart-defaults.js
  - repo path: src/lib/task-service.js
  - repo path: src/lib/done.js
  - repo path: src/cli.js
  - repo path: src/lib/repository-snapshot.js
  - repo path: test/smart-defaults.test.js
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/
  - repo path: src/lib/verification-gates.js
  - repo path: src/lib/evidence-utils.js

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 1 context)

## Deliverables

- `src/lib/smart-defaults.js` module with:
  - `inferProofPaths(workspaceRoot)` 鈥?runs `git diff --name-only HEAD` (staged+unstaged) and returns repo-relative paths
  - `inferTestStatus(workspaceRoot)` 鈥?runs the project's test command (`npm test`) and returns `{ status: 'passed' | 'failed', check: 'npm test' }`, or `null` if no test command configured
- `run:add` and `done` use inferred defaults when `--proof-path` and `--status` are omitted
- Manual flags always override inferred values (explicit > implicit)
- Unit tests covering: git diff parsing, test status detection, override behavior, no-git fallback
- README documents the "zero-flag" workflow

## Risks

- Running `npm test` during `done` could be slow 鈥?mitigate with `--skip-test` flag and a warning if tests take >30s
- Inferring from `git diff HEAD` may include changes outside task scope 鈥?acceptable for Lite mode; Full mode has scope declarations to filter
- Non-npm projects (no `package.json` or no `test` script) 鈥?gracefully degrade to `null`
- `git diff` may fail in non-git repos 鈥?fall back to empty proof paths with a warning

## Acceptance Criteria

- `done T-001 "summary"` with no flags auto-populates proof paths from `git diff` and records a `draft` run
- `done T-001 "summary" --infer-test` runs `npm test`, sets status to passed/failed based on exit code, adds check `npm test: passed/failed`
- Manual `--proof-path` and `--status` flags override inferred values
- Non-git repos: warning printed, proof paths empty, no crash
- No-test-script repos: `--infer-test` prints info message and skips
- `npm test` passes with new tests
