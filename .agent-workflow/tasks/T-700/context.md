# T-700 Context

## Why now

The product vision is: "developer opens dashboard, sees what agents did, approves or rejects, agents pick up automatically." Phase 5 gave agents the ability to produce evidence and trust scores. But the dashboard is still read-only — humans can see but can't act. Without approve/reject, there's no feedback loop. This is the first task in Phase 6 (Agent Autonomy) because everything else (handoff, queue, CI) depends on having a human oversight mechanism.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Dashboard is Preact + Vite, dark mode + responsive (Phase 4)
- Trust score already exists: 0-100, deterministic, in `src/lib/trust-summary.js` and `dashboard-next/src/utils/trustScore.js`
- Task detail API: `GET /api/tasks/:taskId/detail` returns full task with runs, evidence, verification gate
- MCP resources: `workflow://tasks/{taskId}` returns task detail JSON
- task.json currently has: id, title, priority, status, recipeId, createdAt, updatedAt, goal, scope, nonGoals
- task.json does NOT have: reviewStatus, reviewedAt, rejectionFeedback, correctionTaskId — these are new
- Existing task statuses: todo, in_progress, blocked, done
- ApprovalPanel should only appear for tasks with status "done" and no existing reviewStatus

## Open questions

- Should approval be reversible? Leaning no for v1 — once approved, it stays approved. Rejection can be followed by a new approval after the correction task is done.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not break any existing CLI, API, MCP, or test behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`, `npm run dashboard:build`
- Approval state must be backward compatible — old task.json without reviewStatus should work fine
