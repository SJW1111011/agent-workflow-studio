# T-102 - Vitest migration — replace hand-rolled test runner, maintain ≥85% coverage

## Goal

Replace the hand-rolled test runner (`scripts/unit-test.js`) with Vitest, gaining watch mode, coverage reporting, snapshot testing, and TypeScript-native test support. After this task, `npm test` runs Vitest with ≥85% coverage, and contributors get a modern test DX.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: package.json (vitest devDep, test script change)
  - repo path: vitest.config.ts (new)
  - repo path: test/*.test.js → test/*.test.ts (or keep .js with Vitest compat)
  - repo path: scripts/unit-test.js (to be replaced, can be deleted or kept as legacy fallback)
  - repo path: test/test-helpers.js (adapt to Vitest API)
- Out of scope:
  - repo path: scripts/smoke-test.js (E2E smoke stays separate)
  - repo path: src/ (no production code changes)
  - repo path: dashboard/ (frontend tests are a separate concern)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 0 context)

## Deliverables

- `vitest` as devDep in package.json
- `vitest.config.ts` with coverage threshold ≥85%
- All 25 existing test files migrated to Vitest syntax (`describe`, `it`, `expect`)
- Coverage report in `coverage/` (gitignored)
- `npm test` runs Vitest; `npm run test:coverage` shows coverage report

## Risks

- Test helper utilities (`test/test-helpers.js`) may use patterns incompatible with Vitest
- Custom assertion patterns in the hand-rolled runner may not map 1:1 to Vitest's `expect`
- Coverage threshold may surface under-tested modules that need new tests

## Acceptance Criteria

- `npm test` runs Vitest and all tests pass
- Coverage ≥85% (lines) enforced by config
- Watch mode works: `npx vitest --watch`
- No production code changes
- `scripts/smoke-test.js` still works independently
