# T-204 - Auto status transitions — task.json status auto-advances on run:add and done

## Goal

Make `task.json` status transitions automatic so task progress stays truthful without manual metadata edits: the first explicit `run:add` or `done` should move `todo` to `in_progress`, `done --complete` should move the task to `done`, and later run evidence must not regress a manual or completed status. This keeps `task:list` and the dashboard aligned with the real workflow state.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/task-service.js
  - repo path: test/task-service.test.js
  - repo path: test/done.test.js
  - repo path: test/cli.test.js
  - repo path: test/server-api.test.js
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/ (UI status display already reads task.json; no changes needed)
  - repo path: src/lib/verification-gates.js (unchanged)
  - repo path: manual status override via PATCH /api/tasks/{taskId} (keep this working)

## Required docs

- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- docs/ROADMAP.md (Phase 1 context)

## Deliverables

- Auto-transition logic in the shared run persistence path so the first recorded run advances `todo` to `in_progress`
- `done --complete` still advances the task to `done` without changing the existing CLI/API contract
- Automatic transitions remain one-way only; explicit manual overrides stay authoritative
- `task:list` and API task detail now reflect the auto-updated status immediately after recorded work
- Focused tests plus full repo verification for the service, CLI, server API, and `done` integration

## Risks

- Tasks might be marked `in_progress` earlier than some users expect; mitigate by only triggering on explicit recorded runs, not task creation
- `done --complete` can still close a task with open work, but that remains an explicit user choice
- A late run must never overwrite a manual or completed status; coverage is included for the preserved override path

## Acceptance Criteria

- Task with `status: todo` transitions to `in_progress` after `run:add T-001 "..."`
- Task with `status: in_progress` stays `in_progress` after another `run:add`
- Task transitions to `done` after `done T-001 "..." --complete`
- Task with `status: done` is NOT overwritten to `in_progress` by a late `run:add`
- `task:list` shows accurate status at all stages
- Manual PATCH to change status still works
- `npm test` passes with new tests
