# T-201 - done command — one-step evidence recording plus checkpoint

## Goal

Add a `done` CLI command that combines `run:add` + `checkpoint` into a single step. After completing work on a task, the user types `done T-001 "what I did"` and the tool records evidence, refreshes the checkpoint, and optionally marks the task as complete — reducing the current two-command ceremony to one.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/cli.js (register `done` command)
  - repo path: src/lib/done.js (new module — orchestrates run:add + checkpoint)
  - repo path: src/lib/task-service.js (may need a helper to update task status)
  - repo path: src/server.js (add `POST /api/tasks/{taskId}/done` endpoint)
  - repo path: test/done.test.js (new test file)
  - repo path: README.md (document the `done` command)
  - repo path: AGENT_GUIDE.md (update agent workflow)
- Out of scope:
  - repo path: dashboard/ (UI button for `done` deferred to Phase 4)
  - repo path: src/lib/verification-gates.js (smart defaults are T-202)
  - repo path: src/lib/repository-snapshot.js (auto-infer is T-202)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 1 context)

## Deliverables

- `done <taskId> "<summary>"` CLI command with options: `--status`, `--proof-path`, `--check`, `--complete`
- `src/lib/done.js` module: calls `recordRun()` then `buildCheckpoint()`, optionally updates task status to `done`
- `POST /api/tasks/{taskId}/done` API endpoint (for future dashboard integration)
- Unit tests covering: basic done, done with --complete flag, done on Lite task (lazy file creation), done without optional flags
- Documentation in README and AGENT_GUIDE

## Risks

- If `recordRun()` succeeds but `buildCheckpoint()` fails, partial state is left behind — mitigate by recording run first (safe), then checkpoint (idempotent)
- `--complete` flag auto-transitions task to `done` status — users might do this accidentally; require explicit flag, not default
- Must work seamlessly with both Lite and Full mode tasks

## Acceptance Criteria

- `done T-001 "Implemented login"` records a run with `--status draft` and refreshes checkpoint
- `done T-001 "Implemented login" --status passed --complete` records a passed run, refreshes checkpoint, sets task status to `done`
- `done T-001 "..." --proof-path src/auth.js --check "tests pass"` forwards all `run:add` options correctly
- Works on a Lite task (missing context.md/verification.md) — auto-creates as needed
- Existing `run:add` and `checkpoint` commands continue to work independently
- `npm test` passes with new tests
- `npm run smoke` passes
