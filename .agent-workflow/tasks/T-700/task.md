# T-700 - Dashboard Approval Loop

## Goal

Add approve/reject controls to the dashboard so humans can close the feedback loop with agents. When a human approves a task, it gains "human-verified" status that boosts its trust score. When a human rejects a task with feedback, a correction task is automatically created for the next agent to pick up. This is the foundation for autonomous agent work — without human oversight controls, agents have no feedback mechanism.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/components/TaskDetail.jsx (approve/reject buttons, feedback input)
  - repo path: dashboard-next/src/components/ApprovalPanel.jsx (new — approval UI component)
  - repo path: dashboard-next/src/components/TaskList.jsx (review status visible in task overview)
  - repo path: dashboard-next/src/components/TaskKanban.jsx (review status visible in kanban overview)
  - repo path: dashboard-next/src/components/Overview.jsx (human review summary)
  - repo path: dashboard-next/src/styles/app.css (approval panel styling, light + dark)
  - repo path: src/server.js (POST /api/tasks/:taskId/approve, POST /api/tasks/:taskId/reject)
  - repo path: src/lib/overview.js (human review summary stats)
  - repo path: src/lib/task-service.js (approval state, correction task creation, reviewStatus field)
  - repo path: src/lib/mcp-resources.js (include reviewStatus in task detail resource)
  - repo path: src/lib/trust-summary.js (human-verified boosts trust score)
  - repo path: dashboard-next/src/utils/taskBoard.js (review status labels and stats)
  - repo path: dashboard-next/src/utils/trustScore.js (factor in human approval)
  - repo path: test/approval-loop.test.js (new)
  - repo path: test/trust-score.test.js (update for approval weight)
- Out of scope:
  - repo path: src/lib/mcp-tools.js (no new MCP tools in this task — approval is human-only via dashboard)
  - repo path: dashboard/ (legacy dashboard unchanged)

## Design

### Task review state

Add `reviewStatus` field to task.json:
- `null` — not yet reviewed
- `"approved"` — human approved, with optional `reviewedAt` and `reviewedBy`
- `"rejected"` — human rejected, with `rejectionFeedback`, `correctionTaskId`, `reviewedAt`

### API endpoints

`POST /api/tasks/:taskId/approve`
- Body: `{}` (no payload needed)
- Sets `reviewStatus: "approved"`, `reviewedAt: now`
- Returns updated task meta

`POST /api/tasks/:taskId/reject`
- Body: `{ feedback: "string" }`
- Sets `reviewStatus: "rejected"`, `rejectionFeedback: feedback`, `reviewedAt: now`
- Creates a correction task (status: todo, title: "Correction: {original title}", linked via `parentTaskId`)
- Returns `{ task: updatedMeta, correctionTask: newTaskMeta }`

### Dashboard UI

ApprovalPanel component in TaskDetail:
- Shows only for tasks with status "done" and reviewStatus null
- Two buttons: Approve (green) and Reject (red)
- Reject expands a feedback textarea + submit button
- After action, shows the review status badge (approved/rejected)
- Rejected tasks show link to correction task

### Trust score adjustment

Current formula: `0.4 * coverage + 0.25 * signal + 0.2 * freshness + 0.15 * diversity`

Add approval bonus: human-approved tasks get +10 points (capped at 100). Human-rejected tasks get -20 points (floored at 0). This makes human review the strongest trust signal.

### MCP resource update

`workflow://tasks/{taskId}` response includes `reviewStatus`, `reviewedAt`, `rejectionFeedback`, `correctionTaskId` when present.

## Deliverables

- `dashboard-next/src/components/ApprovalPanel.jsx` with approve/reject UI
- Updated `TaskDetail.jsx` integrating ApprovalPanel
- Updated `src/server.js` with two new API endpoints
- Updated `src/lib/task-service.js` with approval state and correction task creation
- Updated `src/lib/mcp-resources.js` with reviewStatus in task detail
- Updated trust score calculation (both server and client)
- `test/approval-loop.test.js` with tests for approve, reject, correction task creation
- Updated `test/trust-score.test.js` for approval weight
- Works in both light and dark themes
- `npm run dashboard:build` succeeds

## Acceptance Criteria

- Human can approve a completed task from dashboard
- Human can reject a completed task with feedback text
- Rejection creates a correction task linked to the original
- Approval state visible in task detail and overview
- Trust score reflects human approval (+10) or rejection (-20)
- reviewStatus appears in MCP task detail resource
- All existing tests pass
- `npm test`, `npm run smoke`, `npm run lint` pass

## Risks

- Approval state must be idempotent — approving twice should not create duplicate state
- Correction task must inherit the original task's scope and recipe
- Feedback text must be sanitized (no script injection in dashboard rendering)
