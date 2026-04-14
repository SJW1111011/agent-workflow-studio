# T-203 Context

## Why now

Lite Mode (T-200) and `done` (T-201) make it fast to create tasks and record evidence. But speed also means more accidental records. Without undo, users must manually find and delete JSON files from `.agent-workflow/tasks/`. Undo is the safety net that makes the fast workflow trustworthy.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Currently there is no undo capability, so mistakes require manual workflow-file cleanup.
- Run records are stored as individual JSON files in `tasks/T-XXX/runs/run-{timestamp}.json`.
- Task directories can contain `task.json`, markdown docs, generated prompt/run artifacts, and a `runs/` subdirectory.
- `recordRun` can also update `verification.md`, auto-advance `task.json`, and materialize missing Lite Mode files.
- `buildCheckpoint` is called both directly and as a side effect of other commands, so explicit `checkpoint` logging must not duplicate nested checkpoint refreshes from `quick`, `run:add`, or `done`.
- Undo metadata must stay repo-relative and portable; absolute machine paths are out of bounds.

## Open questions

- The task direction is now settled on a single `.agent-workflow/undo-log.json` file capped to the latest 20 entries.
- `undo` stays non-interactive for this task; preview or multi-step undo can follow later if the product needs it.
- Exact workflow-file restoration is safer than partial deletion because Lite Mode commands may materialize new docs as a side effect.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-200 and T-201, because those command flows must write undo log entries.
- Workflow layer only: never touch git, never delete user code files.
- No runtime dependencies.
- Any deletion path must stay inside `.agent-workflow/tasks/`.
