# T-100 Context

## Why now

This is the first task in Phase 0 (Infrastructure Modernization). All subsequent phases depend on a typed codebase — TypeScript catches contract mismatches at compile time, enables IDE support, and makes the 27-module `src/lib/` surface area maintainable. Without this foundation, Phases 1–5 will accumulate technical debt faster than they deliver value.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current codebase: ~17k lines of pure JavaScript across 27 `src/lib/` modules
- No type annotations, no `tsconfig.json`, no build step
- Zero runtime dependencies — TypeScript is devDep only, does not violate this principle
- `src/lib/fs-utils.js` is the smallest module (~80 lines) with the fewest dependents — ideal first conversion target
- Project uses CommonJS (`"type": "commonjs"` in package.json)

## Open questions

- Should `allowJs: true` be set so unconverted modules coexist without errors?
- Should output go to `dist/` or compile in-place? `dist/` is cleaner but changes import paths.
- Does `prepublishOnly` or `prepare` better fit the npm publish flow?

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not add any runtime dependencies
- Must not break `npm test` or existing CLI behavior
- Must not require contributors to install TypeScript globally
