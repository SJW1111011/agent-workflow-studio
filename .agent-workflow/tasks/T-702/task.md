# T-702 - Task Queue and Claim Mechanism

## Goal

Add `workflow_claim_task` and `workflow_release_task` MCP tools plus `workflow://queue` resource so agents can discover and claim available tasks. The queue returns unclaimed tasks sorted by priority. Claim sets a lock (claimedBy + claimExpiry) to prevent double-assignment. Auto-release after timeout. Dashboard shows claim status.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/mcp-tools.js (add workflow_claim_task + workflow_release_task tools)
  - repo path: src/lib/mcp-resources.js (add workflow://queue resource)
  - repo path: src/lib/task-service.js (claim/release logic, claimExpiry tracking, auto-release)
  - repo path: dashboard-next/src/components/TaskList.jsx (claim status badges)
  - repo path: dashboard-next/src/components/TaskKanban.jsx (claim status badges)
  - repo path: dashboard-next/src/components/Overview.jsx (claim status in overview)
  - repo path: dashboard-next/src/styles/app.css (claim badge styling)
  - repo path: test/task-queue.test.js (new)
- Out of scope:
  - repo path: src/server.js (no new REST endpoints — queue/claim are MCP-only)
  - repo path: dashboard/ (legacy dashboard unchanged)

## Design

### workflow://queue MCP resource

Returns available tasks (status: todo or in_progress, not claimed or claim expired), sorted by priority (P0 > P1 > P2 > P3), then by createdAt (oldest first).

Response:
```json
{
  "tasks": [
    {
      "id": "T-001",
      "title": "Add authentication",
      "priority": "P0",
      "status": "todo",
      "claimedBy": null,
      "createdAt": "...",
      "trustScore": 0
    }
  ]
}
```

### workflow_claim_task MCP tool

Input:
```json
{
  "taskId": "T-001",
  "agent": "claude-code",
  "claimDuration": 3600
}
```

Actions:
- Check if task is claimable (not claimed, or claim expired)
- Set `claimedBy` to agent
- Set `claimExpiry` to now + claimDuration (default: 3600 seconds = 1 hour)
- Set status to `in_progress` if currently `todo`
- Return task meta

Errors:
- If already claimed by another agent and not expired: `task_already_claimed`

### workflow_release_task MCP tool

Input:
```json
{
  "taskId": "T-001",
  "agent": "claude-code"
}
```

Actions:
- Check if task is claimed by this agent
- Clear `claimedBy` and `claimExpiry`
- Return task meta

Errors:
- If claimed by different agent: `task_claimed_by_other_agent`
- If not claimed: no-op, return success

### Auto-release on expiry

When reading task queue or task detail:
- If `claimExpiry` < now, treat as unclaimed
- Don't auto-clear the fields — just ignore them in queries
- Actual cleanup happens on next claim or explicit release

### Dashboard claim badges

TaskList and TaskKanban show claim status:
- Unclaimed: no badge
- Claimed (not expired): `claimed by {agent}` badge
- Claimed (expired): `claim expired` badge (yellow/warning)

### task.json updates

New fields:
- `claimedBy`: string | null
- `claimExpiry`: ISO timestamp | null

## Deliverables

- `workflow_claim_task` and `workflow_release_task` MCP tools (tools 14 and 15)
- `workflow://queue` MCP resource
- Claim/release logic in task-service.js
- claimExpiry tracking and auto-release on expiry
- Claim status badges in dashboard
- `test/task-queue.test.js`
- All existing tests pass

## Acceptance Criteria

- Agent calls workflow_claim_task → task claimed, claimExpiry set
- Second agent trying to claim same task gets "already claimed" error
- workflow://queue returns only unclaimed or expired-claim tasks
- Claim auto-expires after timeout (default 1 hour)
- Agent calls workflow_release_task → claim released
- Dashboard shows claim status badges
- `npm test`, `npm run smoke`, `npm run lint` pass

## Risks

- Claim expiry must be checked consistently across all code paths (queue, claim, task detail)
- Race condition: two agents claim simultaneously → first write wins, second gets error
- Expired claims should not block new claims — treat as unclaimed
