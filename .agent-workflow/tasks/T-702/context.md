# T-702 Context

## Why now

T-700 (approval) and T-701 (handoff) are complete. Now agents need a way to discover available work. The product vision is "agent checks queue, claims task, works on it." Without a queue resource and claim mechanism, agents can't autonomously pick up tasks — they need humans to tell them which task to work on.

This is the third task in Phase 6 because T-703 (orchestrator) depends on it — the orchestrator spawns agents and tells them to check the queue.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- MCP tools currently: workflow_quick, workflow_done, workflow_task_list, workflow_overview, workflow_validate, workflow_record_activity, workflow_undo, workflow_checkpoint, workflow_append_note, workflow_run_add, workflow_handoff, workflow_pickup (12 tools)
- MCP resources: workflow://overview, workflow://tasks, workflow://tasks/{taskId}, workflow://memory/{docName} (4 resources)
- MCP prompts: workflow-resume, workflow-verify, workflow-handoff (3 prompts)
- task.json currently has: id, title, priority, status, recipeId, createdAt, updatedAt, goal, scope, nonGoals, reviewStatus, claimedBy (from T-701)
- task.json does NOT have: claimExpiry — this is new
- workflow_pickup (from T-701) already sets claimedBy, but doesn't set expiry
- Task statuses: todo, in_progress, blocked, done
- Task priorities: P0, P1, P2, P3

## Open questions

- Should claim duration be configurable per-task? Leaning no — use a global default (1 hour), agent can release early if needed.
- Should expired claims auto-clear the fields? Leaning no — just treat as unclaimed in queries, actual cleanup happens on next claim.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not break any existing CLI, API, MCP, or test behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`, `npm run dashboard:build`
- Claim expiry must be checked consistently — don't return claimed tasks in queue if claim is expired
- workflow_pickup should set claimExpiry when it sets claimedBy (update T-701 behavior)
