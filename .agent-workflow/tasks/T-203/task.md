# T-203 - undo command — roll back the most recent workflow operation

## Goal

Add an `undo` CLI command that rolls back the most recent workflow operation (`quick`, `run:add`, `done`, `checkpoint`). This gives users confidence to try the fast workflow without fear of creating incorrect records. Undo operates on the workflow layer only — it never touches user code or git history.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/undo-log.js (new module — append-only operation log)
  - repo path: src/lib/undo.js (new module — reads log, reverses last operation)
  - repo path: src/cli.js (register `undo` command)
  - repo path: src/lib/quick-task.js (write undo log entry after task creation)
  - repo path: src/lib/task-service.js (write undo log entry after run recording)
  - repo path: src/lib/checkpoint.js (write undo log entry after checkpoint)
  - repo path: src/lib/done.js (write undo log entry after done)
  - repo path: test/undo.test.js (new)
  - repo path: README.md (document undo)
- Out of scope:
  - repo path: dashboard/ (UI for undo deferred)
  - repo path: multi-step undo (only the single most recent operation)
  - repo path: undoing git commits or file edits (workflow layer only)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 1 context)

## Deliverables

- `src/lib/undo-log.js`: appends operation records to `.agent-workflow/undo-log.json` (array of `{type, taskId, timestamp, files, metadata}`)
- `src/lib/undo.js`: reads last entry from undo log, reverses it:
  - `quick` → delete the created task directory
  - `run:add` / `done` → delete the run JSON file, re-derive checkpoint
  - `checkpoint` → restore previous checkpoint.json/md from backup
- `undo` CLI command: prints what will be undone, does it, removes the log entry
- Unit tests: undo quick, undo run:add, undo done, undo checkpoint, undo on empty log
- README documents undo

## Risks

- Undo log could grow unbounded — mitigate by keeping only last 20 entries
- Undoing a `quick` that was already used (has runs) should warn or refuse — check for existing runs before deleting task
- Concurrent operations could corrupt the log — acceptable for single-user CLI tool
- Undoing `done --complete` must also revert the task status change

## Acceptance Criteria

- `undo` after `quick --lite "X"` removes the created task directory
- `undo` after `done T-001 "..."` removes the run record and restores the previous checkpoint
- `undo` after `run:add T-001 "..."` removes the run record
- `undo` on empty log prints "Nothing to undo"
- `undo` refuses to delete a task directory that has runs (warns user)
- Log is capped at 20 entries
- `npm test` passes with new tests
