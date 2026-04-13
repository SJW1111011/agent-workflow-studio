# T-201 Context

## Why now

Today's flow after finishing work is two commands: `run:add T-001 "..." --status passed [--proof-path ...]` then `checkpoint T-001`. That's friction. `done` collapses it to one command and is the most visible "ceremony cut" a user experiences. Should ship together with T-200 (Lite Mode) so the new lightweight workflow story is complete in one release.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `run:add` exists in `src/cli.js` and calls `recordRun()` in `src/lib/task-service.js`.
- `checkpoint` exists in `src/cli.js` and calls `buildCheckpoint()` in `src/lib/checkpoint.js`.
- `recordRun()` returns the persisted run record; the run id is available for follow-up messaging and API responses.
- `recordRun()` already materializes missing Lite task artifacts before persisting evidence, so `done` can stay thin and reuse the same persistence path.
- `buildCheckpoint()` is idempotent and already derives checkpoint state from task metadata plus recorded runs.
- `updateTaskMeta()` can update task status and keep managed task docs synchronized when `--complete` is used.
- The new server endpoint can mirror the existing `/runs` route shape while returning the combined done result.

## Open questions

- `done` without `--complete` should stay aligned with existing `run:add` status behavior unless acceptance criteria force a broader state transition.
- Undo for `done` is covered by T-203 and should not be duplicated here.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Soft dependency on T-200 (Lite Mode): `done` should work on Lite tasks, but can land in either order.
- No runtime dependencies.
- Must pass `npm test`, `npm run lint`, `npm run smoke`.
