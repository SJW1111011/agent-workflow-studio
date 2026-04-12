# T-102 Context

## Why now

The hand-rolled test runner (`scripts/unit-test.js`, ~80 lines) has no coverage, no watch mode, no snapshot support, and no TypeScript integration. As T-100 introduces TypeScript, tests need a runner that natively understands `.ts` files. Vitest is the natural choice: fast, Vite-powered, zero-config for TS, and has first-class coverage via `@vitest/coverage-v8`.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current test runner: `scripts/unit-test.js` — sequential execution, custom assert wrappers, no coverage
- 25 test files in `test/`, covering all major `src/lib/` modules and dashboard helpers
- `test/test-helpers.js` provides shared utilities (mock filesystem, temp dirs, etc.)
- Tests currently use a custom `assert`-style API, not `describe`/`it`/`expect`
- Vitest is a devDep — does not violate zero runtime dependency principle

## Open questions

- Should dashboard test files (11 files) be migrated now or deferred?
- Is `@vitest/coverage-v8` or `@vitest/coverage-istanbul` the right coverage provider?
- Should test files stay `.js` or convert to `.ts` in this task?

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Can run in parallel with T-100 (TypeScript) — no hard dependency
- Must not change any production code in `src/`
- Coverage threshold must be enforced, not just reported
- Vitest is devDep only
