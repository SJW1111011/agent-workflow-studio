# T-403 Context

## Why now

T-202 (Phase 1) added smart defaults as opt-in. With T-400 (vocabulary) and T-401 (strict opt-in) landing, the evidence model is now simple enough that auto-extraction should be the default path. The "30-second task record" promise from Phase 1 is not fully delivered until `done T-001 "summary"` with zero flags produces complete evidence.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- T-202 built `smart-defaults.js` with `inferProofPaths()` (always-on when no explicit --proof-path) and `inferTestStatus()` (opt-in via --infer-test)
- Proof path inference from `git diff --name-only HEAD` is already the default in `resolveRunSmartDefaults()` when `inferScopeProofPaths !== false`
- Test inference requires `inferTestStatus === true` currently — this task considers making it project-configurable
- `project.json` already has `schemaVersion` field — adding `autoInferTest` is backward compatible

## Open questions

- Should `autoInferTest` default to `true` or `false`? Leaning `false` — users should opt in because test suites vary in speed and reliability.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-400 (vocabulary) for consistent labeling
- Must not slow down `done` command when tests are disabled
- Must pass `npm test`, `npm run lint`, `npm run smoke`
