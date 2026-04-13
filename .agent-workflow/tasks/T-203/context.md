# T-203 Context

## Why now

Lite Mode (T-200) and `done` (T-201) make it fast to create tasks and record evidence. But speed also means more accidental records. Without undo, users must manually find and delete JSON files from `.agent-workflow/tasks/`. Undo is the safety net that makes the fast workflow trustworthy.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Currently there is no undo capability — mistakes require manual file deletion
- Run records are stored as individual JSON files in `tasks/T-XXX/runs/run-{timestamp}.json`
- Task directories contain task.json + markdown docs + runs/ subdirectory
- Checkpoint is a derived artifact (checkpoint.json + checkpoint.md) that can be regenerated
- The undo log is a new concept — no existing infrastructure to build on

## Open questions

- Should undo log be `.agent-workflow/undo-log.json` (single file) or `.agent-workflow/undo/` (directory with one file per operation)? Single file is simpler.
- Should undo be interactive (prompt confirmation) or non-interactive (just do it)? Leaning non-interactive with a `--dry-run` flag to preview.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-200, T-201 (those commands must write undo log entries)
- Workflow layer only — never touch git, never delete user code files
- No runtime dependencies
