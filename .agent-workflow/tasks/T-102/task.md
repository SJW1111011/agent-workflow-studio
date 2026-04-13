# T-102 - Vitest migration - replace hand-rolled test runner, maintain >=85% coverage

## Goal

Replace the hand-rolled test runner (`scripts/unit-test.js`) with Vitest so contributors get watch mode, coverage reporting, snapshot support, and TypeScript-friendly test execution without changing production behavior.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking established contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: `package.json` (Vitest dev dependencies and test scripts)
  - repo path: `package-lock.json` (lockfile updates for the new dev dependencies)
  - repo path: `.gitignore` (ignore the generated coverage output)
  - repo path: `vitest.config.ts` (new Vitest configuration with enforced coverage)
  - repo path: `scripts/unit-test.js` (replace the hand-rolled runner with a Vitest bridge or remove it)
  - repo path: `test/*.test.js` (migrate all 25 existing test files to Vitest suite structure)
  - repo path: `test/test-helpers.js` (adapt shared test helpers to Vitest lifecycle hooks)
- Out of scope:
  - repo path: `src/` (no production code changes)
  - repo path: `dashboard/app.js` (frontend app changes are not part of this runner migration)
  - repo path: `scripts/smoke-test.js` (smoke coverage must keep working independently)

## Required docs

- `.agent-workflow/project-profile.md`
- `.agent-workflow/memory/product.md`
- `.agent-workflow/memory/architecture.md`
- `docs/ROADMAP.md`

## Deliverables

- `vitest` and `@vitest/coverage-v8` as dev dependencies in `package.json`
- `vitest.config.ts` with an enforced >=85% line-coverage threshold
- All 25 existing `test/*.test.js` files running under Vitest
- Coverage output in `coverage/` and ignored from Git
- `npm test` using Vitest and `npm run test:coverage` producing the coverage report

## Risks

- Shared test helpers may need lifecycle cleanup changes once Vitest re-runs suites in watch mode.
- Some assertion patterns may need light adaptation if Vitest exposes timing or isolation differences.
- The enforced coverage threshold may reveal modules that were only incidentally covered by the old runner.

## Acceptance Criteria

- `npm test` runs Vitest and all tests pass
- Coverage is enforced at >=85% lines by configuration
- `npx vitest --watch` works for contributors
- No production code changes land in `src/`
- `scripts/smoke-test.js` still runs independently
