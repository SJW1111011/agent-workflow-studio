# T-401 Context

## Why now

Content fingerprinting is the most confusing part of the evidence model. Users see "anchor-backed" vs "compatibility-only" labels without understanding why. The fingerprint computation also adds latency (SHA1 of every scoped file). Making it opt-in removes the cognitive and performance overhead for the 90% of users who don't need audit-grade proof, while preserving it for the 10% who do.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `workspace.js` now resolves strict mode from either explicit CLI/MCP input or `.agent-workflow/project.json` `strictVerification`
- `repository-snapshot.js` skips content fingerprint hashing unless strict mode is enabled and now refuses parent-repo Git snapshots when `workspaceRoot` is not the repository root
- `verification-gates.js` now uses timestamp freshness by default and only evaluates anchor-backed freshness when strict mode is enabled
- `task-service.js`, `checkpoint.js`, `done.js`, and `run-executor.js` all thread the resolved strict mode through run persistence and checkpoint refresh
- `task-documents.js` preserves existing managed manual anchor blocks when strict mode is off instead of refreshing or deleting them
- CLI, MCP, README, smoke coverage, and unit tests were updated together so strict opt-in is exercised explicitly instead of relying on the old default

## Open questions

- `run:execute` now respects the resolved strict workspace mode through `persistRunRecord()` and `buildCheckpoint()`

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-400 (vocabulary must be renamed first)
- Must not delete existing fingerprint data; just stop computing or displaying it in normal mode
- Must pass `npm test`, `npm run lint`, `npm run smoke`
