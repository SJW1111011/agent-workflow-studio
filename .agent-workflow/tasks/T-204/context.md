# T-204 Context

## Why now

Currently task status is set to `todo` on creation and never automatically updated. Users see all tasks as `todo` in `task:list` even after recording multiple runs. This makes the task list unreliable as a progress tracker. With T-201 (`done`) adding the `--complete` flag, the auto-transition machinery is needed to make it meaningful.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- task.json `status` now auto-advances from `todo` to `in_progress` inside `persistRunRecord()`, the shared persistence path used by manual and executor-backed runs.
- The automatic transition only fires when the current task status is `todo`; `in_progress`, `blocked`, and `done` are preserved unless the user explicitly changes them.
- `recordDone(..., { complete: true })` already routes through `updateTaskMeta(..., { status: "done" })`, so no extra `done.js` logic change was required to satisfy the completion transition.
- `task:list` and `GET /api/tasks/:taskId` now reflect the persisted status immediately after a recorded run because they already read `task.json`.
- Focused coverage was added for the shared service, CLI `task:list`, `done`, and the server `/runs` plus manual PATCH interaction.

## Open questions

- Resolved: yes, executor-backed runs now also advance `todo` to `in_progress` because the transition is enforced in shared run persistence.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must integrate cleanly with T-201 (`done` command)
- Status transitions are one-way (never regress automatically)
- No runtime dependencies
- Must pass `npm test`, `npm run lint`, `npm run smoke`
