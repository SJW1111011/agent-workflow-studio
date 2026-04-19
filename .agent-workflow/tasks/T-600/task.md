# T-600 - Evidence Collector Plugin System

## Goal

Replace the hardcoded npm-test inference in `src/lib/smart-defaults.js` with a pluggable evidence collector registry. Ship four built-in collectors (npm-test, pytest, cargo-test, go-test) so projects using any of these test runners get automatic evidence without configuration. Allow custom collectors via `project.json`.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/evidence-collectors.js (new — registry + 4 built-in collectors)
  - repo path: src/lib/smart-defaults.js (refactor to delegate to registry)
  - repo path: src/lib/workspace.js (read evidenceCollectors from project.json)
  - repo path: test/evidence-collectors.test.js (new — unit tests)
- Out of scope:
  - repo path: src/lib/mcp-tools.js (T-602 wires collectors into MCP)
  - repo path: dashboard-next/ (no dashboard changes)

## Design

Each collector is a plain object: `{ id, name, detect(workspaceRoot), execute(workspaceRoot), priority }`.

- `detect(workspaceRoot)` returns boolean — checks if the test runner is present (e.g., package.json with test script, pyproject.toml, Cargo.toml, go.mod)
- `execute(workspaceRoot)` returns `{ status: "passed"|"failed"|null, check: string, durationMs: number }`
- `priority` determines execution order (lower = first)

Built-in collectors:
1. `npm-test` — extracted from current `inferTestStatusResult()` in smart-defaults.js
2. `pytest` — detects pyproject.toml or setup.py with pytest; runs `python -m pytest --tb=no -q`
3. `cargo-test` — detects Cargo.toml; runs `cargo test --no-fail-fast`
4. `go-test` — detects go.mod; runs `go test ./...`

Registry: `createCollectorRegistry(workspaceRoot)` loads built-ins + optional custom collectors from `project.json` `evidenceCollectors` array. Custom collectors specify `{ id, command, args, detectFile }`.

`smart-defaults.js` changes: `inferTestStatus` calls `registry.detectAndExecute()` which runs the first matching collector (by priority). Returns same shape as today for backward compatibility.

## Deliverables

- `src/lib/evidence-collectors.js` with registry, 4 built-in collectors, and custom collector loader
- `src/lib/smart-defaults.js` refactored to use collector registry
- `src/lib/workspace.js` updated to read `evidenceCollectors` config
- `test/evidence-collectors.test.js` with tests for detection, execution, registry, and custom collectors
- All existing tests pass unchanged

## Acceptance Criteria

- `npm test` passes; existing npm-test behavior unchanged when no config
- Python project with pyproject.toml: `detect()` returns true for pytest collector
- Rust project with Cargo.toml: `detect()` returns true for cargo-test collector
- Go project with go.mod: `detect()` returns true for go-test collector
- Custom collector can be registered via project.json `evidenceCollectors` array
- Backward compatible: no config = npm-test only (same as today)
- No new runtime dependencies

## Risks

- pytest/cargo/go may not be installed on the machine — collectors must handle missing binaries gracefully (return null, not throw)
- Custom collector config must be validated to prevent command injection
- Windows compatibility: command invocation differs (cmd.exe wrapping)
