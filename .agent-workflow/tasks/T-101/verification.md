# T-101 Verification

## Planned checks

- automated:
  - `npm test`
  - `node -e "import('agent-workflow-studio').then((m) => console.log(Object.keys(m).sort().join(',')))"`
  - `node -e "console.log(Object.keys(require('agent-workflow-studio')).sort().join(','))"`
  - `node --input-type=module -e "import pkg, { workspace } from 'agent-workflow-studio'; import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const cjs = require('agent-workflow-studio'); if (workspace !== cjs.workspace || pkg.workspace !== cjs.workspace) { throw new Error('dual-package hazard detected'); } console.log('shared-singleton-ok');"`
- manual:
  - `npx agent-workflow --help`

## Proof links

### Proof 1

- Files: `package.json`, `src/index.ts`, `index.js`, `index.mjs`
- Check: Add a CommonJS barrel plus an ESM wrapper, then verify package-name `import`, package-name `require`, shared singleton identity, published-style CLI help output, and the packed tarball contents.
- Result: Passed on 2026-04-13.
- Artifact: `.agent-workflow/tasks/T-101/runs/test-output.txt`, `.agent-workflow/tasks/T-101/runs/import-output.txt`, `.agent-workflow/tasks/T-101/runs/require-output.txt`, `.agent-workflow/tasks/T-101/runs/singleton-output.txt`, `.agent-workflow/tasks/T-101/runs/npx-help.txt`, `.agent-workflow/tasks/T-101/runs/pack-output.txt`

## Blocking gaps

- None yet.

## Evidence 2026-04-13T01:20:54.261Z

- Agent: codex
- Status: passed
- Scoped files covered: package.json, src/index.ts, index.js, index.mjs
- Verification artifacts: .agent-workflow/tasks/T-101/runs/test-output.txt, .agent-workflow/tasks/T-101/runs/import-output.txt, .agent-workflow/tasks/T-101/runs/require-output.txt, .agent-workflow/tasks/T-101/runs/singleton-output.txt, .agent-workflow/tasks/T-101/runs/npx-help.txt, .agent-workflow/tasks/T-101/runs/pack-output.txt
- Proof artifacts: .agent-workflow/tasks/T-101/runs/test-output.txt, .agent-workflow/tasks/T-101/runs/import-output.txt, .agent-workflow/tasks/T-101/runs/require-output.txt, .agent-workflow/tasks/T-101/runs/singleton-output.txt, .agent-workflow/tasks/T-101/runs/npx-help.txt, .agent-workflow/tasks/T-101/runs/pack-output.txt
- Summary: Verified the dual-package wrapper entrypoints for import, require, singleton identity, CLI help, and packed publish contents.
- Verification check: [passed] npm test - 25 files and 99 tests passed after the pretest build
- Verification check: [passed] import('agent-workflow-studio') - exported keys were default,workspace
- Verification check: [passed] require('agent-workflow-studio') - exported key was workspace
- Verification check: [passed] shared singleton probe - import and require resolved the same workspace object
- Verification check: [passed] npx agent-workflow --help - CLI help output still works
- Verification check: [passed] npm pack --dry-run --json --cache ./.npm-cache-tmp - tarball includes index.js, index.mjs, and dist/index.js

## Evidence 2026-04-13T06:55:45.608Z

- Agent: manual
- Status: passed
- Scoped files covered: package.json, src/index.ts, index.js, index.mjs
- Summary: Claude Code review passed: ESM dual-package, singleton identity verified, no dual-package hazard, all 7 review dimensions green
- Verification check: [passed] require('agent-workflow-studio') returns {workspace}
- Verification check: [passed] import('agent-workflow-studio') returns {default,workspace}
- Verification check: [passed] singleton identity test: true (no dual-package hazard)
- Verification check: [passed] npm test passes (25 files, 99 tests)
- Verification check: [passed] CLI still works
- Verification check: [passed] smoke test passes
- Verification check: [passed] zero runtime dependencies
