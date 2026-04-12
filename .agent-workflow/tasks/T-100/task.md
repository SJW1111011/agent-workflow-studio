# T-100 - TypeScript migration skeleton — tsconfig, build pipeline, first module converted

## Goal

Set up the TypeScript build pipeline and convert the first module (`src/lib/fs-utils.js`) to TypeScript as a proof-of-concept. After this task, any new code can be written in `.ts` and the project emits JavaScript that existing CJS consumers can still `require()`. This is an incremental migration — not a big-bang rewrite.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: tsconfig.json (new)
  - repo path: package.json (add build script, devDeps)
  - repo path: src/lib/fs-utils.js → src/lib/fs-utils.ts
  - repo path: src/lib/fs-utils.d.ts (if needed for bridge)
  - repo path: .gitignore (add dist/, *.tsbuildinfo)
- Out of scope:
  - repo path: src/cli.js (not yet)
  - repo path: src/server.js (not yet)
  - repo path: dashboard/ (frontend, separate concern)
  - repo path: test/ (tests stay JS for now, import compiled output)

## Required docs

- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- docs/ROADMAP.md (Phase 0 context)

## Deliverables

- `tsconfig.json` with strict mode, `outDir: dist/`, `rootDir: src/`
- `src/lib/fs-utils.ts` — fully typed version of fs-utils.js
- `package.json` updated: `typescript` as devDep, `build` script, `prepublishOnly` hook
- `.gitignore` updated for build artifacts
- All existing tests still pass (`npm test`)

## Risks

- Breaking existing `require('agent-workflow-studio')` imports if output paths change
- TypeScript strict mode may surface latent type errors in dependent modules
- Build step adds friction to contributor workflow — mitigate with clear README instructions

## Acceptance Criteria

- `npm run build` succeeds
- `npm test` passes (tests import compiled JS, not TS directly)
- `require('./src/lib/fs-utils')` still works (CJS compat)
- `tsconfig.json` uses `strict: true`
- Zero runtime dependencies added
