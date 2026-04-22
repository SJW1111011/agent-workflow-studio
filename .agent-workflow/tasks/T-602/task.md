# T-602 - Smart Defaults v2: Multi-Collector Integration

## Goal

Wire the evidence collector registry (T-600) into the `done` and `run:add` CLI commands and the `workflow_done` MCP tool so all matching test frameworks run automatically when recording evidence. Add `--skip-test` flag to bypass collector execution.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/smart-defaults.js (inferTestStatusResult returns array of collector results)
  - repo path: src/lib/done.js (pass collector results to run record)
  - repo path: src/lib/task-service.js (store collector results in evidence.collectors[])
  - repo path: src/lib/mcp-tools.js (workflow_done uses new defaults, add skipTest param)
  - repo path: src/cli.js (add --skip-test flag to done and run:add)
  - repo path: test/smart-defaults-v2.test.js (new tests)
- Out of scope:
  - repo path: src/lib/evidence-collectors.js (already done in T-600)
  - repo path: dashboard-next/ (T-604 handles dashboard changes)

## Design

- `inferTestStatusResult` currently returns a single collector result. Change it to `inferAllTestResults` which runs all matching collectors (not just the first) and returns an array.
- Each result: `{ collectorId, status, check, durationMs }`
- Run record stores results in `evidence.collectors[]` alongside existing `evidence.checks` and `evidence.proofPaths`
- `workflow_done` MCP tool gains optional `skipTest: boolean` parameter
- CLI `done` and `run:add` gain `--skip-test` flag
- When `--skip-test` is set, no collectors run (proof paths from git diff still inferred)
- Backward compatible: single npm-test result still produces same run record shape; `evidence.collectors` is additive

## Deliverables

- Updated `smart-defaults.js` with `inferAllTestResults`
- Updated `done.js` and `task-service.js` to store collector array
- Updated `mcp-tools.js` with `skipTest` parameter
- Updated `cli.js` with `--skip-test` flag
- `test/smart-defaults-v2.test.js` with tests for multi-collector and skip-test
- All existing tests pass unchanged

## Acceptance Criteria

- Project with both package.json and pyproject.toml: both npm-test and pytest collectors run
- `--skip-test` skips all collectors but still infers proof paths
- Run record contains `evidence.collectors[]` array
- Existing single-collector projects produce identical results
- `npm test` passes; `npm run smoke` passes

## Risks

- Running multiple test suites sequentially may be slow — document that `--skip-test` is the escape hatch
- Collector array in run record must not break existing run record parsing
