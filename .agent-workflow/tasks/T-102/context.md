# T-102 Context

## Why now

The hand-rolled runner in `scripts/unit-test.js` gives the repo no coverage reporting, no watch mode, and no TypeScript-native path as Phase 0 modernizes the toolchain. Moving to Vitest brings the test DX up to the level the roadmap now expects without changing runtime dependencies for published users.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The current runner executes suites sequentially from `scripts/unit-test.js` and does not produce coverage.
- There are 25 existing `test/*.test.js` files, and the current runner accidentally omits `test/workspace.test.js`.
- `test/test-helpers.js` already centralizes temp-workspace helpers, so it is the best place for Vitest cleanup hooks.
- T-100 already introduced TypeScript build output, so the new runner must coexist with the existing `pretest` build step.
- Vitest and `@vitest/coverage-v8` stay in devDependencies only, which preserves the zero-runtime-dependency product constraint.

## Open questions

- Migrate every existing `test/*.test.js` file now rather than splitting the suite across two runners.
- Use `@vitest/coverage-v8` so coverage stays close to Node's runtime and does not add Istanbul-only behavior.
- Keep the tests as `.js` in this task to avoid widening the scope into a second TypeScript migration.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not change production code under `src/`.
- Coverage threshold must be enforced by config, not reported informally.
- Smoke coverage remains separate from the unit-runner migration.
- The repo is already dirty from other tasks, so this work must stay tightly scoped.
