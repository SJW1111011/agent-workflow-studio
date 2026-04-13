# T-201 Context

## Why now

Today's flow after finishing work is two commands: `run:add T-001 "..." --status passed [--proof-path ...]` then `checkpoint T-001`. That's friction. `done` collapses it to one command and is the most visible "ceremony cut" a user experiences. Should ship together with T-200 (Lite Mode) so the new lightweight workflow story is complete in one release.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `run:add` exists in `src/cli.js` and calls `recordRun()` in `src/lib/task-service.js`
- `checkpoint` exists in `src/cli.js` and calls `buildCheckpoint()` in `src/lib/checkpoint.js`
- `recordRun()` returns the persisted run record; the run id is needed for follow-up
- `buildCheckpoint()` reads all runs from disk and computes verification gate state
- task.json has a `status` field that can be `todo`, `in_progress`, `done`
- Currently no command transitions task status automatically — it stays `todo` until manually changed

## Open questions

- Should `done` without `--complete` transition `todo` → `in_progress` automatically? Leaning yes.
- Should there be an undo for `done`? — covered by T-203, do not duplicate here.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Soft dependency on T-200 (Lite Mode): `done` should work on Lite tasks, but can land in either order
- No runtime dependencies
- Must pass `npm test`, `npm run lint`, `npm run smoke`
