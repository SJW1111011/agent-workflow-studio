# T-204 - Auto status transitions — task.json status auto-advances on run:add and done

## Goal

Make `task.json` status transitions automatic: `todo` → `in_progress` when the first `run:add` or `done` is called, `in_progress` → `done` when `done --complete` is used. Users should never need to manually edit task.json to update status. This also enables accurate status reporting in `task:list` and the dashboard.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/task-service.js (add auto-transition logic to `recordRun` and `updateTaskMeta`)
  - repo path: src/lib/done.js (use `--complete` to trigger `done` status)
  - repo path: src/cli.js (no new commands, but `run:add` and `done` now trigger transitions)
  - repo path: src/server.js (API endpoints that record runs should also trigger transitions)
  - repo path: test/task-service.test.js (new — test status transitions)
  - repo path: test/done.test.js (verify transitions integrate correctly)
- Out of scope:
  - repo path: dashboard/ (UI status display already reads task.json; no changes needed)
  - repo path: src/lib/verification-gates.js (unchanged)
  - repo path: manual status override via PATCH /api/tasks/{taskId} (keep this working)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 1 context)

## Deliverables

- Auto-transition logic in `recordRun()`: if task status is `todo`, advance to `in_progress`
- Auto-transition logic in `done --complete`: advance to `done` regardless of current status
- Status is never regressed automatically (manual override via PATCH still allowed)
- `task:list` accurately reflects the auto-updated status
- Unit tests covering: todo→in_progress on first run, in_progress stays in_progress on second run, done on --complete, manual override preserved

## Risks

- Tasks might be marked `in_progress` before the user intends — mitigate by only triggering on explicit `run:add` or `done`, not on `quick`
- `done --complete` could close a task that still has open work — acceptable because user explicitly passed `--complete`
- Must not regress: a manually set `done` status should not be overwritten back to `in_progress` by a late `run:add`

## Acceptance Criteria

- Task with `status: todo` transitions to `in_progress` after `run:add T-001 "..."`
- Task with `status: in_progress` stays `in_progress` after another `run:add`
- Task transitions to `done` after `done T-001 "..." --complete`
- Task with `status: done` is NOT overwritten to `in_progress` by a late `run:add`
- `task:list` shows accurate status at all stages
- Manual PATCH to change status still works
- `npm test` passes with new tests
