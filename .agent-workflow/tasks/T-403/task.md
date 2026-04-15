# T-403 - Auto evidence extraction — git diff paths and test exit code populate evidence automatically on every run

## Goal

Make `done` and `run:add` always auto-populate evidence from git diff and (optionally) test results by default, so users never need to think about `--proof-path` or `--check` flags. Phase 1's T-202 added smart defaults as opt-in behavior; this task makes it the default and ensures it integrates with the new evidence vocabulary from T-400. The goal is: `done T-001 "what I did"` with zero flags produces verified-quality evidence automatically.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/smart-defaults.js (make proof path inference always-on, refine test inference)
  - repo path: src/lib/task-service.js (ensure defaults always fire when flags are omitted)
  - repo path: src/cli.js (remove the need for explicit `--infer-test` — make it configurable via project.json)
  - repo path: src/lib/done.js (pass through enhanced defaults)
  - repo path: .agent-workflow/project.json (add `autoInferTest: false` project-level setting)
  - repo path: src/lib/mcp-tools.js (update default behavior in tool schemas)
  - repo path: test/smart-defaults.test.js (update tests)
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/ (no UI changes)
  - repo path: non-npm test runners (Python, Rust, Go — future plugin work)

## Deliverables

- Proof path inference from `git diff` is always-on by default (already was in T-202, confirm it stays on)
- Test inference (`npm test` exit code) becomes configurable via `project.json` `autoInferTest` setting instead of per-command `--infer-test` flag
- `--skip-test` flag still works to suppress on individual commands
- Evidence auto-populated by defaults uses the new T-400 vocabulary (draft vs verified)
- Documentation showing the zero-flag workflow: `done T-001 "summary"` → verified evidence

## Risks

- Running `npm test` on every `done` could be slow for large projects — mitigate with `autoInferTest: false` default and clear docs
- Some repos have expensive or flaky test suites — `--skip-test` must always work

## Acceptance Criteria

- `done T-001 "summary"` with zero flags auto-populates proof paths from git diff
- With `autoInferTest: true` in project.json, `done` also runs `npm test` and records the result
- `--skip-test` suppresses test inference regardless of project setting
- Evidence recorded by defaults produces `verified`-quality records (paths + check)
- `npm test` passes
