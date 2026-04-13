# T-201 Verification

## Planned checks

- automated: `npm test`
- automated: `npm run lint`
- automated: `npm run smoke`
- manual: Run `node src/cli.js done T-201 "Implemented the done command, docs, and verification coverage." --status passed --proof-path src/cli.js --proof-path src/lib/done.js --proof-path src/server.js --proof-path test/done.test.js --proof-path README.md --proof-path AGENT_GUIDE.md --check "npm run lint" --check "npm test" --check "npm run smoke" --check "Manual done CLI flow" --complete --root .` to confirm the one-step path records evidence, refreshes the checkpoint, and marks the task done.

## Proof links

### Proof 1

- Files: src/cli.js, src/lib/done.js, src/server.js, test/done.test.js, README.md, AGENT_GUIDE.md
- Check: `npm run lint`, `npm test`, `npm run smoke`, and the manual `done` CLI flow all passed.
- Result: Added the shared `src/lib/done.js` orchestrator, wired `done` into the CLI and `POST /api/tasks/{taskId}/done`, covered the new flow with dedicated tests, updated the user and agent docs, then recorded `run-1776074015037` via the new command and refreshed the checkpoint with task status `done`.
- Artifact: .agent-workflow/tasks/T-201/runs/run-1776074015037.json, .agent-workflow/tasks/T-201/checkpoint.md

## Blocking gaps

- None.

## Evidence 2026-04-13T09:53:35.036Z

- Agent: manual
- Status: passed
- Scoped files covered: src/cli.js, src/lib/done.js, src/server.js, test/done.test.js, README.md, AGENT_GUIDE.md
- Summary: Implemented the done command, docs, and verification coverage.
- Verification check: [passed] npm run lint
- Verification check: [passed] npm test
- Verification check: [passed] npm run smoke
- Verification check: [passed] Manual done CLI flow

## Evidence 2026-04-13T13:49:52.545Z

- Agent: manual
- Status: passed
- Scoped files covered: src/lib/done.js, src/cli.js, src/server.js, test/done.test.js
- Summary: Claude Code review passed: done command combines run:add+checkpoint, --complete marks task done, server endpoint works, all 7 review dimensions green
- Verification check: [passed] done T-001 summary records draft run + refreshes checkpoint
- Verification check: [passed] done --complete marks task status done
- Verification check: [passed] done on Lite task auto-materializes missing docs
- Verification check: [passed] POST /api/tasks/{taskId}/done endpoint works
- Verification check: [passed] npm test passes (26 files, 109 tests)
- Verification check: [passed] zero runtime dependencies
