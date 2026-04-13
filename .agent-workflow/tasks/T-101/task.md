# T-101 - ESM dual-package - exports field, CJS backward-compat preserved

## Goal

Configure the package for ESM + CJS dual publishing so downstream consumers can use either `import` or `require()`. After this task, `import { workspace } from 'agent-workflow-studio'` works in ESM projects while existing `require()` users are unaffected.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: `package.json`
  - repo path: `src/index.ts`
  - repo path: `index.js`
  - repo path: `index.mjs`
- Out of scope:
  - repo path: `dashboard/` (browser code, not npm-published as module)
  - repo path: `src/cli.js` (CLI entry point stays CJS bin)
  - repo path: `src/server.js`
  - repo path: `test/` (tests can stay CJS)
  - repo path: `tsconfig.esm.json`

## Required docs

- `.agent-workflow/project-profile.md`
- `docs/ROADMAP.md` (Phase 0 context)
- Node.js dual-package documentation (`https://nodejs.org/api/packages.html#dual-commonjses-module-packages`)

## Deliverables

- `package.json` with a conditional `exports` map (`import` -> `index.mjs`, `require` -> `index.js`)
- `src/index.ts` as the public CommonJS-backed API barrel
- `index.js` and `index.mjs` entry shims that preserve one shared module instance
- verification artifacts proving both `import` and `require` work from the package name

## Risks

- Dual-package hazard: same module loaded twice (ESM + CJS) causes identity issues
- `"type": "module"` would break internal `require()` calls across the existing `.js` modules
- Bin entry (`src/cli.js`) must remain CJS-compatible for global `npx` usage

## Acceptance Criteria

- `node -e "import('agent-workflow-studio').then((m) => console.log(Object.keys(m)))"` succeeds
- `node -e "console.log(Object.keys(require('agent-workflow-studio')))"` succeeds
- `node --input-type=module -e "import pkg, { workspace } from 'agent-workflow-studio'; import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const cjs = require('agent-workflow-studio'); console.log(workspace === cjs.workspace && pkg.workspace === cjs.workspace)"` prints `true`
- `npx agent-workflow --help` still works
- `npm test` passes