# T-400 Verification

## Draft checks

- automated: `npm test`
- automated: `npm run lint`
- automated: `npm run smoke`
- manual: inspect CLI, MCP, dashboard, and README output for the new evidence vocabulary

## Verification records

### Record 1

- Files: `src/lib/evidence-utils.js`, `src/lib/verification-proof.js`, `src/lib/verification-gates.js`, `src/lib/overview.js`, `src/lib/checkpoint.js`, `src/lib/task-documents.js`, `src/lib/mcp-tools.js`
- Check: renamed the core evidence, gate, freshness, and signal helpers to the `draft` / `verified` vocabulary while preserving legacy aliases for existing records
- Result: passed
- Artifact: `.agent-workflow/tasks/T-400/runs/npm-test.log`

### Record 2

- Files: `dashboard/document-helpers.js`, `dashboard/execution-detail-helpers.js`, `dashboard/form-event-helpers.js`, `dashboard/form-state-helpers.js`, `dashboard/index.html`, `dashboard/task-board-helpers.js`, `dashboard/task-detail-helpers.js`, `dashboard/task-list-render-helpers.js`
- Check: verified the dashboard editor, board, detail, and refresh flows now present `draft`, `verified`, `action-required`, `incomplete`, `unconfigured`, and `recorded-only` wording consistently
- Result: passed
- Artifact: `.agent-workflow/tasks/T-400/runs/npm-smoke.log`

### Record 3

- Files: `README.md`, `scripts/smoke-test.js`, `test/overview.test.js`, `test/verification-gates.test.js`, `test/dashboard-task-detail-helpers.test.js`, `test/dashboard-task-list-render-helpers.test.js`, `test/dashboard-form-state-helpers.test.js`, `test/dashboard-form-event-helpers.test.js`, `test/server-api.test.js`
- Check: updated the docs and regression coverage so the simplified vocabulary is asserted directly while legacy proof headings and statuses still load through compatibility fallbacks
- Result: passed
- Artifact: `.agent-workflow/tasks/T-400/runs/npm-test.log`, `.agent-workflow/tasks/T-400/runs/npm-lint.log`, `.agent-workflow/tasks/T-400/runs/npm-smoke.log`

## Blocking gaps

- none

## Evidence 2026-04-15T17:35:27.723Z

- Agent: codex
- Status: passed
- Scoped files covered: README.md, dashboard/document-helpers.js, dashboard/execution-detail-helpers.js, dashboard/form-event-helpers.js, dashboard/form-state-helpers.js, dashboard/index.html, dashboard/task-board-helpers.js, dashboard/task-detail-helpers.js, dashboard/task-list-render-helpers.js, scripts/smoke-test.js, src/lib/checkpoint.js, src/lib/evidence-utils.js, src/lib/mcp-tools.js, src/lib/overview.js, src/lib/skill-generator.js, src/lib/task-documents.js, src/lib/verification-gates.js, src/lib/verification-proof.js, test/dashboard-form-event-helpers.test.js, test/dashboard-form-state-helpers.test.js, test/dashboard-task-detail-helpers.test.js, test/dashboard-task-list-render-helpers.test.js, test/overview.test.js, test/server-api.test.js, test/verification-gates.test.js
- Verification artifacts: .agent-workflow/tasks/T-400/runs/npm-test.log, .agent-workflow/tasks/T-400/runs/npm-lint.log, .agent-workflow/tasks/T-400/runs/npm-smoke.log
- Proof artifacts: .agent-workflow/tasks/T-400/runs/npm-test.log, .agent-workflow/tasks/T-400/runs/npm-lint.log, .agent-workflow/tasks/T-400/runs/npm-smoke.log
- Summary: Renamed evidence vocabulary to draft/verified across source helpers, dashboard surfaces, docs, smoke coverage, and regression tests.
- Verification check: [passed] npm test passes (32 files, 156 tests)
- Verification check: [passed] npm run lint passes
- Verification check: [passed] npm run smoke passes
- Verification check: [passed] dashboard, CLI, MCP, and README surfaces use the draft/verified vocabulary while older records still parse

## Evidence 2026-04-16T11:45:47.856Z

- Agent: manual
- Status: passed
- Scoped files covered: src/lib/evidence-utils.js, src/lib/overview.js, src/lib/verification-gates.js, src/lib/verification-proof.js, src/lib/checkpoint.js, dashboard/task-detail-helpers.js
- Summary: Claude Code review passed: draft/verified two-tier vocabulary, gate statuses renamed, dashboard backward compat, old data loads correctly, 85.62% coverage
- Verification check: [passed] signal: strong→verified, mixed→partial, planned→draft
- Verification check: [passed] gate: needs-proof→action-required, partially-covered→incomplete, scope-missing→unconfigured
- Verification check: [passed] backward compat: old values accepted as aliases
- Verification check: [passed] validate on 16 pre-Phase-3 tasks: ok=true
- Verification check: [passed] npm test passes (32 files, 156 tests)
- Verification check: [passed] coverage 85.62% >= 85%
