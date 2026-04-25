# T-701 Context

## Why now

T-700 (approval loop) is complete. Now agents need to be able to pass work to each other. The product vision includes "Agent A works on a task, session ends, Agent B picks up and continues." Without a handoff protocol, the second agent has no structured way to know what was done and what's left. The `workflow-handoff` prompt exists (from T-601) but it's read-only — we need tools that write state.

This is the second task in Phase 6 because task queue (T-702) depends on it — claiming a task is conceptually similar to picking up a handoff.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- MCP tools currently: workflow_quick, workflow_done, workflow_task_list, workflow_overview, workflow_validate, workflow_record_activity, workflow_undo (7 tools)
- MCP prompts: workflow-resume, workflow-verify, workflow-handoff (3 prompts)
- workflow-handoff prompt (from T-601) returns task context but doesn't write state
- Run records stored in `runs/run-{timestamp}.json`
- Activity records stored in `runs/activity-{timestamp}.json`
- Checkpoint refreshed by `done` command and `workflow_done` tool
- task.json currently has: id, title, priority, status, recipeId, createdAt, updatedAt, goal, scope, nonGoals, reviewStatus (from T-700)
- task.json does NOT have: claimedBy, handoffRecords — these are new
- Evidence timeline in dashboard shows runs and activity records chronologically

## Open questions

- Should handoff automatically refresh checkpoint? Leaning yes — handoff is a natural checkpoint moment.
- Should pickup require the task to be in_progress? Leaning no — agent should be able to pickup a todo task (first claim).

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not break any existing CLI, API, MCP, or test behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`, `npm run dashboard:build`
- Handoff records must be append-only — no overwrites
- claimedBy must be nullable — task can be unclaimed
