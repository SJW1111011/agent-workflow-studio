# T-203 - undo command roll back the most recent workflow operation

## Goal

Add an `undo` CLI command that rolls back the most recent workflow operation (`quick`, `run:add`, `done`, `checkpoint`). This gives users confidence to try the fast workflow without fear of creating incorrect records. Undo operates on the workflow layer only: it never touches user code or git history.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/undo-log.js
  - repo path: src/lib/undo.js
  - repo path: src/cli.js
  - repo path: src/lib/quick-task.js
  - repo path: src/lib/task-service.js
  - repo path: src/lib/checkpoint.js
  - repo path: src/lib/done.js
  - repo path: test/undo.test.js
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/
  - repo path: multi-step undo history
  - repo path: git commits or source file edits outside .agent-workflow/

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 1 context)

## Deliverables

- `src/lib/undo-log.js`: appends operation records to `.agent-workflow/undo-log.json` (array of `{type, taskId, timestamp, files, metadata}`)
- `src/lib/undo.js`: reads the latest undo entry and reverses it safely inside `.agent-workflow/`
- `undo` CLI command: prints the rollback target, performs it, and removes the log entry
- unit tests: undo quick, undo run:add, undo done, undo checkpoint, undo on empty log, quick safety refusal, log cap
- README documentation for undo

## Risks

- Undo log could grow unbounded unless it is capped to the latest 20 entries
- Undoing a `quick` that was already used (has runs) must warn or refuse before deleting the task directory
- Partial rollback would leave stale `verification.md`, `checkpoint.*`, or `task.json` state behind
- Undoing `done --complete` must also revert the task status change

## Acceptance Criteria

- `undo` after `quick --lite "X"` removes the created task directory
- `undo` after `done T-001 "..."` removes the run record and restores the previous checkpoint
- `undo` after `run:add T-001 "..."` removes the run record
- `undo` on empty log prints `Nothing to undo`
- `undo` refuses to delete a task directory that has runs (warns user)
- Log is capped at 20 entries
- `npm test` passes with new tests
