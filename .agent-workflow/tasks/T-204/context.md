# T-204 Context

## Why now

Currently task status is set to `todo` on creation and never automatically updated. Users see all tasks as `todo` in `task:list` even after recording multiple runs. This makes the task list unreliable as a progress tracker. With T-201 (`done`) adding the `--complete` flag, the auto-transition machinery is needed to make it meaningful.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- task.json `status` field currently accepts: `todo`, `in_progress`, `done`
- `createTask()` sets initial status to `todo`
- `recordRun()` in `task-service.js` persists a run record but does NOT update task status
- `updateTaskMeta()` in `task-service.js` updates task.json fields — this is the write path for status
- `task:list` reads task.json and displays status — it will immediately reflect auto-transitions
- Dashboard `GET /api/tasks` also reads task.json — no dashboard code changes needed

## Open questions

- Should `run:execute` (adapter execution) also trigger todo→in_progress? Leaning yes, since it implies work has started.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must integrate cleanly with T-201 (`done` command)
- Status transitions are one-way (never regress automatically)
- No runtime dependencies
- Must pass `npm test`, `npm run lint`, `npm run smoke`
