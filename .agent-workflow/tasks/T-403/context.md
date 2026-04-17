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

## Progress notes

### 2026-04-17T01:55:00.000Z

Reviewed the T-403 task bundle, project memory, smart-default resolution path, CLI help text, MCP schemas, and the dashboard API entrypoints. Confirmed proof-path inference is already on by default, while test inference still defaults off in the CLI and MCP call sites and needs a project-level `autoInferTest` setting plus pass-through changes so omitted flags can still infer `npm test`.

### 2026-04-17T01:58:49.000Z

Patched the shared project-config/default path, updated the CLI/MCP/API surfaces, and refreshed the README plus task metadata for the new `autoInferTest` workflow. The focused `npm test -- test/smart-defaults.test.js` regression pass succeeded with 10/10 tests green before the full repository verification sweep.

### 2026-04-17T02:01:00.000Z

Completed the full verification sweep with `npm test`, `npm run lint`, and `npm run smoke`, saving the logs under `.agent-workflow/tasks/T-403/runs/`. Because the repository already had unrelated dirty files outside T-403, the final task evidence will use explicit proof paths instead of raw git-diff inference so the recorded run does not accidentally claim someone else's in-progress changes.

### 2026-04-17T02:03:20.000Z

Recorded the durable T-403 run with explicit proof paths, verification checks, and log artifacts, then refreshed the checkpoint. The checkpoint now reports `covered` verification status with 100% evidence coverage across the 11 scoped files currently changed for this task.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-400 (vocabulary) for consistent labeling
- Must not slow down `done` command when tests are disabled
- Must pass `npm test`, `npm run lint`, `npm run smoke`
