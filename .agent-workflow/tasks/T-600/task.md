# T-600 - Evidence Collector Plugin System

## Goal

Replace the hardcoded npm test inference in `src/lib/smart-defaults.js` with a pluggable evidence collector registry so the workflow can automatically capture test evidence across JavaScript, Python, Rust, and Go repositories without per-project code changes. Keep existing npm-first behavior stable for Node workspaces, and allow repo-local custom collectors through `.agent-workflow/project.json` when a project needs a runner the built-ins do not cover.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/evidence-collectors.js (new registry + built-in collectors)
  - repo path: src/lib/smart-defaults.js (delegate test inference to the registry)
  - repo path: src/lib/workspace.js (read and normalize `evidenceCollectors` from project.json)
  - repo path: src/lib/schema-validator.js (validate custom collector config shape)
  - repo path: test/evidence-collectors.test.js (detection, execution, registry, and custom collector coverage)
  - repo path: README.md
  - repo path: docs/RECIPES_AND_SCHEMA.md
- Out of scope:
  - repo path: src/lib/mcp-tools.js (T-602 handles MCP wording and follow-on integration)
  - repo path: dashboard-next/ (no dashboard changes)

## Design

Each collector is a plain object: `{ id, name, detect(workspaceRoot), execute(workspaceRoot), priority }`.

- `detect(workspaceRoot)` returns a boolean for whether the runner is present.
- `execute(workspaceRoot)` returns `{ status: "passed" | "failed" | null, check: string, durationMs: number }`.
- `priority` determines execution order (lower runs first).

Built-in collectors:
1. `npm-test` extracted from the current `inferTestStatusResult()` flow in `smart-defaults.js`
2. `pytest` detects `pyproject.toml` or `setup.py` usage and runs `python -m pytest --tb=no -q`
3. `cargo-test` detects `Cargo.toml` and runs `cargo test --no-fail-fast`
4. `go-test` detects `go.mod` and runs `go test ./...`

Registry: `createCollectorRegistry(workspaceRoot)` loads built-ins plus optional custom collectors from `project.json` `evidenceCollectors`. Custom collectors use `{ id, command, args, detectFile }`.

`smart-defaults.js` should keep the existing public return shape while delegating collector selection and execution to the registry.

## Deliverables

- `src/lib/evidence-collectors.js` with the registry, built-in collectors, and custom collector loading
- `src/lib/smart-defaults.js` refactored to use the collector registry
- `src/lib/workspace.js` updated to read `evidenceCollectors`
- `src/lib/schema-validator.js` updated to validate collector config
- `test/evidence-collectors.test.js` covering detection, execution, registry behavior, and custom collectors
- updated docs and verification evidence

## Acceptance Criteria

- existing npm-test behavior stays unchanged for Node workspaces without extra config
- Python project with `pyproject.toml` or `setup.py` and pytest markers: `detect()` returns true for the pytest collector
- Rust project with `Cargo.toml`: `detect()` returns true for the cargo collector
- Go project with `go.mod`: `detect()` returns true for the go collector
- custom collector entries can be registered via `project.json` `evidenceCollectors`
- missing binaries are handled gracefully with a null result instead of throwing
- no new runtime dependencies

## Risks

- pytest, cargo, or go may not be installed on the machine, so launch failures must stay non-fatal
- custom collector config must be validated tightly enough to avoid shell-style command injection
- Windows command invocation differs for npm and needs to stay backward compatible
