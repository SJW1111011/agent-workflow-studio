# T-200 Context

## Why now

Phase 0 (TypeScript, Vitest, ESM, CI) is complete. Phase 1's central goal is "90% of daily tasks recordable in 30 seconds." Currently `quick` generates 7 files including prompt compilation, run preparation, and checkpoint — excessive for "I just want to track that I'm doing something." Lite Mode is the foundation that all other Phase 1 tasks build on: `done` (T-201) and smart defaults (T-202) both depend on having a minimal task scaffold to work against.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `quick` currently calls: `createTask()` → `compilePrompt()` → `prepareRun()` → `buildCheckpoint()` — four expensive steps
- `createTask()` in `task-service.js` generates task.json + task.md + context.md + verification.md + checkpoint skeleton + runs/ directory
- `compilePrompt()` reads project profile + memory docs + task docs to assemble a prompt file
- `prepareRun()` generates run-request JSON + launch-pack markdown
- `buildCheckpoint()` calls `buildTaskVerificationGate()` which does a full repository snapshot — the heaviest operation
- The dashboard's `getTaskDetail()` also calls `buildTaskVerificationGate()`, so it must tolerate missing optional files
- `verification-gates.js` reads `verification.md` for scope hints and manual proof — must return a neutral gate when file is absent

## Open questions

- Should context.md be included in Lite (3 files) or excluded (2 files)? Leaning toward excluding — it can auto-create on first `run:add`.
- Should `--lite` become the default now or in a follow-up? Leaning toward follow-up to avoid changing behavior mid-Phase-1.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not break any existing `quick --full` behavior — Full Mode is a preserved contract
- Must not add runtime dependencies
- Must pass `npm test`, `npm run lint`, `npm run smoke`
- Dashboard must still render Lite tasks (may show empty sections for missing docs)
