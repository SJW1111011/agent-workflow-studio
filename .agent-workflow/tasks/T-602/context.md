# T-602 Context

## Why now

Polyglot repositories can match more than one evidence collector, so the old "first match wins" path leaves verification incomplete even when users expect smart defaults to do the right thing. This task closes that gap while keeping an explicit skip path for fast manual evidence recording.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `src/lib/smart-defaults.js` now exports `inferAllTestResults`, executes every matching collector in priority order, and keeps the older single-result helper as a compatibility wrapper.
- `src/lib/task-service.js` now derives inferred run status from all collector outcomes, maps collector results into inferred verification checks, and persists additive collector metadata under `run.evidence.collectors[]`.
- `src/lib/mcp-tools.js` now accepts `skipTest` as the preferred MCP flag while still honoring the legacy `skipInferTest` alias.
- The CLI already exposed `--skip-test`, so the user-visible CLI change landed through the shared smart-default execution path instead of new argument parsing.
- `test/smart-defaults-v2.test.js` now covers multi-collector execution order, additive collector evidence, `run:add --skip-test`, and `workflow_done` with `skipTest: true`.
- Acceptance verification completed on 2026-04-22 with `npm test` and `npm run smoke`.

## Open questions

- None at handoff.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
