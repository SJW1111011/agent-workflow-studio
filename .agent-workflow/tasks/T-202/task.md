# T-202 - Smart defaults — auto-infer scope from git diff and checks from test exit code

## Goal

When recording evidence via `run:add` or `done`, automatically infer `--proof-path` from `git diff` (changed files) and `--check` / `--status` from the test runner exit code, so users can type just `done T-001 "what I did"` with zero flags and still get meaningful evidence. Manual flags override the inferred values.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/smart-defaults.js (new module — git diff inference, test runner detection)
  - repo path: src/lib/task-service.js (integrate inferred defaults into `recordRun`)
  - repo path: src/lib/done.js (pass inferred defaults through)
  - repo path: src/cli.js (`run:add` and `done` use smart defaults when flags omitted)
  - repo path: src/lib/repository-snapshot.js (expose a lightweight "changed files" query without full fingerprinting)
  - repo path: test/smart-defaults.test.js (new)
  - repo path: README.md (document smart defaults behavior)
- Out of scope:
  - repo path: dashboard/ (UI integration deferred)
  - repo path: src/lib/verification-gates.js (this task provides data; gates consume it unchanged)
  - repo path: src/lib/evidence-utils.js (normalization stays the same; this task produces better inputs)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 1 context)

## Deliverables

- `src/lib/smart-defaults.js` module with:
  - `inferProofPaths(workspaceRoot)` — runs `git diff --name-only HEAD` (staged+unstaged) and returns repo-relative paths
  - `inferTestStatus(workspaceRoot)` — runs the project's test command (`npm test`) and returns `{ status: 'passed' | 'failed', check: 'npm test' }`, or `null` if no test command configured
- `run:add` and `done` use inferred defaults when `--proof-path` and `--status` are omitted
- Manual flags always override inferred values (explicit > implicit)
- Unit tests covering: git diff parsing, test status detection, override behavior, no-git fallback
- README documents the "zero-flag" workflow

## Risks

- Running `npm test` during `done` could be slow — mitigate with `--skip-test` flag and a warning if tests take >30s
- Inferring from `git diff HEAD` may include changes outside task scope — acceptable for Lite mode; Full mode has scope declarations to filter
- Non-npm projects (no `package.json` or no `test` script) — gracefully degrade to `null`
- `git diff` may fail in non-git repos — fall back to empty proof paths with a warning

## Acceptance Criteria

- `done T-001 "summary"` with no flags auto-populates proof paths from `git diff` and records a `draft` run
- `done T-001 "summary" --infer-test` runs `npm test`, sets status to passed/failed based on exit code, adds check `npm test: passed/failed`
- Manual `--proof-path` and `--status` flags override inferred values
- Non-git repos: warning printed, proof paths empty, no crash
- No-test-script repos: `--infer-test` prints info message and skips
- `npm test` passes with new tests
