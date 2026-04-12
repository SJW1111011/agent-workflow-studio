# T-101 - ESM dual-package — exports field, CJS backward-compat preserved

## Goal

Configure the package for ESM + CJS dual publishing so downstream consumers can use either `import` or `require()`. After this task, `import { workspace } from 'agent-workflow-studio'` works in ESM projects while existing `require()` users are unaffected.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: package.json (`exports` field, `type` field adjustment)
  - repo path: tsconfig.json (if ESM output needs separate config)
  - repo path: src/index.ts or index.js (public API barrel export)
- Out of scope:
  - repo path: dashboard/ (browser code, not npm-published as module)
  - repo path: src/cli.js (CLI entry point stays CJS bin)
  - repo path: test/ (tests can stay CJS)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 0 context)
- Node.js dual-package documentation (https://nodejs.org/api/packages.html#dual-commonjses-module-packages)

## Deliverables

- `package.json` with conditional `exports` map (`import` → ESM, `require` → CJS)
- Public API barrel file exporting key modules
- Verification: both `import` and `require` work in a test script

## Risks

- Dual-package hazard: same module loaded twice (ESM + CJS) causes identity issues
- `"type": "module"` change could break internal `require()` calls across 27 modules
- Bin entry (`src/cli.js`) must remain CJS-compatible for global `npx` usage

## Acceptance Criteria

- `node -e "import('agent-workflow-studio').then(m => console.log(Object.keys(m)))"` succeeds
- `node -e "console.log(Object.keys(require('agent-workflow-studio')))"` succeeds
- `npx agent-workflow --help` still works
- `npm test` passes
- No dual-package hazard (singleton test)
