# T-200 Context

## Why now

Phase 0 (TypeScript, Vitest, ESM, CI) is complete. Phase 1's central goal is "90% of daily tasks recordable in 30 seconds." Right now `quick` generates prompt, run-prep, and checkpoint artifacts even when the user only wants to capture a task quickly. Lite Mode is the foundation for later Phase 1 work such as `done` (T-201) and smart defaults (T-202), because both depend on a minimal task scaffold that can grow on demand.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `quick` currently calls `createTask() -> compilePrompt() -> prepareRun() -> buildCheckpoint()`.
- `createTask()` currently generates `task.json`, `task.md`, `context.md`, `verification.md`, `checkpoint.md`, and `runs/`.
- `compilePrompt()` already reads missing docs as empty strings, but its prompt bundle still points agents at `context.md` and `verification.md`.
- `prepareRun()` already compiles the prompt on demand when the adapter prompt file is missing.
- `buildCheckpoint()` always rebuilds the verification gate, which is the heaviest operation in the `quick` path.
- `recordRun()` appends directly to `verification.md`, so Lite tasks need lazy verification doc creation before evidence is recorded.
- `buildTaskFreshness()` and task detail APIs already report missing docs without crashing, which keeps the dashboard compatible with Lite tasks.

## Open questions

- Lite will stay at exactly 2 files: `task.json` + `task.md`.
- `--full` remains the default in T-200; the default flip stays for a follow-up task after Lite is verified.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not break any existing `quick --full` behavior because Full Mode is a preserved contract.
- Must not add runtime dependencies.
- Must pass `npm test`, `npm run lint`, and `npm run smoke`.
- Dashboard task detail and overview flows must still tolerate missing optional Lite docs.
