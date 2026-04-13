# T-101 Context

## Why now

Node.js ecosystem has moved to ESM. Libraries that only export CJS are increasingly friction for downstream consumers using `import` syntax. This must land alongside or shortly after T-100 (TypeScript migration) so the TypeScript compiler can output both formats from the start.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current: `"type": "commonjs"`, `"main": "index.js"`, no `exports` field
- The `bin` entry (`"agent-workflow": "src/cli.js"`) must stay CJS so `npx` keeps working
- Node.js conditional exports (`exports` field) is stable since Node 12.11
- The project has zero runtime dependencies, so no transitive CJS/ESM conflicts
- The current TypeScript build already emits CommonJS from `src/` into `dist/`, so a CJS barrel can be added without a second build config
- The safest route is the Node wrapper pattern: keep the package CommonJS, expose `require()` through a small bridge, and expose ESM through an `.mjs` wrapper that re-exports the same CJS instance

## Open questions

- No open design questions remain for this slice; use the wrapper pattern and verify the shared singleton behavior explicitly.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-100 (TypeScript skeleton must exist first)
- Must not break `npx agent-workflow` CLI usage
- Must not introduce runtime dependencies