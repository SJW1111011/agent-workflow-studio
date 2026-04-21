# T-600 Verification

## Draft checks

- automated: `npm test`, `npm run lint`, `npm run format:check`, `npm run validate -- --root .`
- manual: reviewed the registry priority order and confirmed the run recorded only task-owned proof paths instead of unrelated dirty-worktree files

## Verification records

### Record 1

- Files: `src/lib/evidence-collectors.js`, `src/lib/smart-defaults.js`, `src/lib/workspace.js`, `src/lib/schema-validator.js`, `test/evidence-collectors.test.js`, `README.md`, `docs/RECIPES_AND_SCHEMA.md`
- Check: `npm test`; `npm run lint`; `npm run format:check`; `npm run validate -- --root .`
- Result: passed
- Artifact: `.agent-workflow/tasks/T-600/runs/run-1776620252924.json`

## Blocking gaps

- none

## Evidence 2026-04-19T17:37:32.922Z

- Agent: manual
- Status: passed
- Scoped files covered: src/lib/evidence-collectors.js, src/lib/smart-defaults.js, src/lib/workspace.js, src/lib/schema-validator.js, test/evidence-collectors.test.js, README.md, docs/RECIPES_AND_SCHEMA.md, .agent-workflow/tasks/T-600/task.md, .agent-workflow/tasks/T-600/context.md
- Summary: Implemented evidence collector registry with built-in npm, pytest, cargo, go, and validated custom collectors.
- Verification check: [passed] npm test
- Verification check: [passed] npm run lint
- Verification check: [passed] npm run format:check
- Verification check: [passed] npm run validate -- --root .
