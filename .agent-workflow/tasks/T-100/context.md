# T-100 Context

## Why now

This is the first task in Phase 0 (Infrastructure Modernization). Later phases need a typed codebase, but the migration has to stay incremental so current CommonJS tooling, local-first workflows, and existing npm consumers keep working while the repository starts emitting compiled JavaScript from TypeScript sources.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The repository is still CommonJS (`"type": "commonjs"` in `package.json`), so the first TypeScript step has to preserve `require()` compatibility.
- `allowJs: true` lets unconverted `src/` modules continue to emit into `dist/` while `strict: true` applies to the converted TypeScript module.
- `src/lib/fs-utils.js` now acts as a narrow bridge to `dist/lib/fs-utils.js`, which keeps existing `require('./fs-utils')` call sites stable.
- The publish whitelist now includes `dist/`, and repo-local tests rebuild before execution so the bridge always points at fresh compiled output.
- No runtime dependencies were added; the migration uses `typescript` and `@types/node` as devDependencies only.

## Open questions

- Future migration tasks should decide whether repo-local scripts eventually execute from `dist/` directly instead of relying on source-side bridges.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not add any runtime dependencies.
- Must not break `npm test` or existing CommonJS imports.
- Must not require contributors to install TypeScript globally.