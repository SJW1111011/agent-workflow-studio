# T-201 - done command — one-step evidence recording plus checkpoint

## Goal

Add a `done` CLI command that combines `run:add` + `checkpoint` into a single step. After completing work on a task, the user types `done T-001 "what I did"` and the tool records evidence, refreshes the checkpoint, and optionally marks the task as complete, reducing the current two-command ceremony to one.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/cli.js
  - repo path: src/lib/done.js
  - repo path: src/lib/task-service.js
  - repo path: src/server.js
  - repo path: test/done.test.js
  - repo path: README.md
  - repo path: AGENT_GUIDE.md
- Out of scope:
  - repo path: dashboard/
  - repo path: src/lib/verification-gates.js
  - repo path: src/lib/repository-snapshot.js

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 1 context)

## Deliverables

- `done <taskId> "<summary>"` CLI command with options: `--status`, `--proof-path`, `--check`, `--complete`
- `src/lib/done.js` module: calls `recordRun()` then `buildCheckpoint()`, optionally updates task status to `done`
- `POST /api/tasks/{taskId}/done` API endpoint (for future dashboard integration)
- Unit tests covering: basic done, done with `--complete`, done on Lite tasks, and done without optional flags
- Documentation in README and AGENT_GUIDE

## Risks

- If `recordRun()` succeeds but `buildCheckpoint()` fails, partial state is left behind; mitigate by recording the run first, then rebuilding the checkpoint.
- `--complete` auto-transitions task status to `done`; require the explicit flag so users do not do this accidentally.
- Must work seamlessly with both Lite and Full mode tasks.

## Acceptance Criteria

- `done T-001 "Implemented login"` records a run with `--status draft` and refreshes the checkpoint.
- `done T-001 "Implemented login" --status passed --complete` records a passed run, refreshes the checkpoint, and sets task status to `done`.
- `done T-001 "..." --proof-path src/auth.js --check "tests pass"` forwards all `run:add` options correctly.
- Works on a Lite task (missing `context.md` / `verification.md`) and auto-creates them as needed.
- Existing `run:add` and `checkpoint` commands continue to work independently.
- `npm test` passes with new tests.
- `npm run smoke` passes.
