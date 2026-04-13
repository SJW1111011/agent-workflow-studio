# T-100 - TypeScript migration skeleton - tsconfig, build pipeline, first module converted

## Goal

Set up a strict TypeScript build path that emits CommonJS into `dist/`, convert `src/lib/fs-utils.js` into typed `src/lib/fs-utils.ts`, and keep existing CommonJS callers working through a small `src/lib/fs-utils.js` bridge. This keeps the migration incremental so new modules can move to `.ts` without forcing a repo-wide rewrite or breaking current `require()`-based consumers.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: `tsconfig.json`
  - repo path: `package.json`
  - repo path: `.gitignore`
  - repo path: `.npmignore`
  - repo path: `src/lib/fs-utils.ts`
  - repo path: `src/lib/fs-utils.js`
  - repo path: `scripts/unit-test.js`
  - repo path: `test/fs-utils.test.js`
  - repo path: `README.md`
  - repo path: `docs/PUBLISHING.md`
- Out of scope:
  - repo path: `src/cli.js`
  - repo path: `src/server.js`
  - repo path: `dashboard/`
  - repo path: remaining `src/lib/*.js` modules
  - repo path: migrating `test/` to TypeScript

## Required docs

- `.agent-workflow/project-profile.md`
- `.agent-workflow/memory/product.md`
- `.agent-workflow/memory/architecture.md`
- `docs/ROADMAP.md`

## Deliverables

- `tsconfig.json` with `strict: true`, `outDir: dist/`, and `rootDir: src/`
- `src/lib/fs-utils.ts` plus a CommonJS bridge at `src/lib/fs-utils.js`
- `package.json` updated with `typescript` and `@types/node` devDependencies, `build`, `pretest`, and `prepublishOnly`
- `.gitignore` and `.npmignore` updated for build artifacts
- documentation updates for contributor and publishing flows
- all existing tests still pass (`npm test`)

## Risks

- Breaking existing `require('agent-workflow-studio')` imports if output paths change
- TypeScript strict mode may surface latent type errors in dependent modules
- Build step adds friction to contributor workflow - mitigate with clear README instructions

## Acceptance Criteria

- `npm run build` succeeds
- `npm test` passes
- `require('./src/lib/fs-utils')` still works (CJS compat)
- `tsconfig.json` uses `strict: true`
- zero runtime dependencies added