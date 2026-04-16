# T-404 Verification

## Planned checks

- automated: `npm test`
- automated: `npm run lint`
- automated: `npm run validate -- --root .`
- automated: `npm run smoke`
- manual: inspect legacy run alias handling, legacy manual anchor preservation, and regenerated checkpoint wording

## Proof links

### Proof 1

- Files: `src/lib/evidence-utils.js`, `src/lib/task-service.js`, `src/lib/verification-gates.js`, `src/lib/overview.js`, `src/lib/verification-proof.js`, `src/lib/schema-validator.js`, `test/migration-compatibility.test.js`
- Check: legacy run aliases, legacy manual anchor payloads, legacy checkpoint wording, strict-off manual anchor preservation, and validate compatibility all pass through the new read-normalization path without rewriting historical files
- Result: passed
- Artifact: `.agent-workflow/tasks/T-404/runs/npm-test-migration.log`

### Proof 2

- Files: `README.md`
- Check: added an "Upgrading from pre-Phase-3" section that explains the no-manual-migration path and the strict-verification note for managed anchor refresh
- Result: passed
- Artifact:

### Proof 3

- Files: `.agent-workflow/project.json`, `.agent-workflow/tasks/`
- Check: `npm run validate -- --root .` returns `ok=true errors=0 warnings=0 strict=false` against the repository's own dogfood workflow state
- Result: passed
- Artifact: `.agent-workflow/tasks/T-404/runs/npm-validate-t404.log`

### Proof 4

- Files: `scripts/smoke-test.js`
- Check: `npm run smoke` passes after the smoke fixture explicitly enables strict verification before refreshing manual proof anchors
- Result: passed
- Artifact: direct command output only; redirecting the smoke run on this Windows machine changes the nested `run:execute` behavior, so the pass was verified from the live command result instead of a saved log

### Proof 5

- Files: repo-wide
- Check: `npm test` passes (33 files, 165 tests) and `npm run lint` passes after the migration compatibility changes land
- Result: passed
- Artifact: `.agent-workflow/tasks/T-404/runs/npm-lint-t404.log`

## Blocking gaps

- No blocking gaps for the scoped migration change. The only verification caveat is that smoke-log redirection is unstable on this Windows machine, so the smoke pass is evidenced by the live command result rather than a durable log file.

## Evidence 2026-04-16T12:25:57.185Z

- Agent: manual
- Status: passed
- Scoped files covered: src/lib/evidence-utils.js, src/lib/task-service.js, src/lib/verification-gates.js, src/lib/overview.js, src/lib/schema-validator.js, test/migration-compatibility.test.js, README.md, scripts/smoke-test.js
- Verification artifacts: .agent-workflow/tasks/T-404/runs/npm-test-migration.log, .agent-workflow/tasks/T-404/runs/npm-lint-t404.log, .agent-workflow/tasks/T-404/runs/npm-validate-t404.log
- Proof artifacts: .agent-workflow/tasks/T-404/runs/npm-test-migration.log, .agent-workflow/tasks/T-404/runs/npm-lint-t404.log, .agent-workflow/tasks/T-404/runs/npm-validate-t404.log
- Summary: Added transparent read-compatibility for legacy workflow data and documented the pre-Phase-3 upgrade path.
- Verification check: [passed] migration-compatibility suite passes (5 tests)
- Verification check: [passed] npm test passes (33 files, 165 tests)
- Verification check: [passed] npm run lint passes
- Verification check: [passed] npm run validate -- --root . returns ok=true errors=0 warnings=0 strict=false
- Verification check: [passed] npm run smoke passes

## Evidence 2026-04-16T12:32:15.757Z

- Agent: manual
- Status: passed
- Scoped files covered: src/lib/evidence-utils.js, src/lib/task-service.js, src/lib/verification-gates.js, src/lib/overview.js, src/lib/verification-proof.js, src/lib/schema-validator.js, test/migration-compatibility.test.js, README.md, scripts/smoke-test.js
- Verification artifacts: .agent-workflow/tasks/T-404/runs/npm-test-migration.log, .agent-workflow/tasks/T-404/runs/npm-lint-t404.log, .agent-workflow/tasks/T-404/runs/npm-validate-t404.log
- Proof artifacts: .agent-workflow/tasks/T-404/runs/npm-test-migration.log, .agent-workflow/tasks/T-404/runs/npm-lint-t404.log, .agent-workflow/tasks/T-404/runs/npm-validate-t404.log
- Summary: Finalized transparent read-compatibility for legacy workflow evidence, tightened T-404 scope docs, and documented the pre-Phase-3 upgrade path.
- Verification check: [passed] migration-compatibility suite passes (5 tests)
- Verification check: [passed] npm test passes (33 files, 165 tests)
- Verification check: [passed] npm run lint passes
- Verification check: [passed] npm run validate -- --root . returns ok=true errors=0 warnings=0 strict=false
- Verification check: [passed] npm run smoke passes

## Evidence 2026-04-16T12:46:54.951Z

- Agent: manual
- Status: passed
- Scoped files covered: src/lib/schema-validator.js, src/lib/evidence-utils.js, test/migration-compatibility.test.js
- Summary: Claude Code review passed: legacy run records load, old vocabulary accepted, schema validator dual-vocab, migration-compatibility.test.js added
- Verification check: [passed] validate on 16+ pre-Phase-3 tasks: ok=true
- Verification check: [passed] Legacy run records with old field names load correctly
- Verification check: [passed] No file rewriting required
- Verification check: [passed] npm test passes (33 files, 165 tests)
