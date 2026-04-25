# T-701 - Cross-Agent Handoff Protocol

## Goal

Add `workflow_handoff` and `workflow_pickup` MCP tools so agents can pass work to each other with an unbroken evidence chain. When Agent A's session is ending, it calls `workflow_handoff` to record what's done and what's left. When Agent B starts, it calls `workflow_pickup` to get full context and continue from the checkpoint. The handoff chain is visible in the dashboard.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/mcp-tools.js (add workflow_handoff + workflow_pickup tools)
  - repo path: src/lib/task-service.js (handoff record storage, pickup logic, claimedBy tracking)
  - repo path: src/lib/mcp-resources.js (include handoff chain in task detail resource)
  - repo path: dashboard-next/src/components/TaskDetail.jsx (handoff chain display)
  - repo path: dashboard-next/src/styles/app.css (handoff chain styling)
  - repo path: test/handoff-protocol.test.js (new)
- Out of scope:
  - repo path: src/server.js (no new REST endpoints — handoff is MCP-only)
  - repo path: dashboard/ (legacy dashboard unchanged)

## Design

### workflow_handoff MCP tool

Input:
```json
{
  "taskId": "T-001",
  "summary": "Completed database schema migration, still need to update ORM models",
  "filesModified": ["src/db/schema.js"],
  "remaining": "Update ORM models in src/models/ to match new schema"
}
```

Actions:
- Creates a handoff record in `runs/handoff-{timestamp}.json`
- Refreshes checkpoint with handoff context
- Sets task `claimedBy` to null (releases the task for pickup)
- Does NOT change task status (stays in_progress)

Handoff record:
```json
{
  "id": "handoff-1776...",
  "type": "handoff",
  "taskId": "T-001",
  "agent": "claude-code",
  "summary": "...",
  "remaining": "...",
  "filesModified": [...],
  "createdAt": "..."
}
```

### workflow_pickup MCP tool

Input:
```json
{
  "taskId": "T-001",
  "agent": "codex"
}
```

Actions:
- Reads the latest handoff record + checkpoint
- Sets `claimedBy` to the new agent
- Returns full context: task.md, latest handoff summary, remaining work, checkpoint, evidence so far

Response:
```json
{
  "taskId": "T-001",
  "handoff": { "summary": "...", "remaining": "...", "agent": "claude-code" },
  "checkpoint": "...",
  "evidenceSoFar": { "runs": 2, "coveragePercent": 50 }
}
```

### Handoff chain in dashboard

TaskDetail shows a "Handoff History" section:
- Chronological list of handoff records
- Each entry: agent name, timestamp, summary, remaining work
- Visual chain: Agent A → Agent B → Agent C

### MCP resource update

`workflow://tasks/{taskId}` includes `handoffRecords[]` and `claimedBy` in the response.

## Deliverables

- `workflow_handoff` and `workflow_pickup` MCP tools (tools 12 and 13)
- Handoff record storage in `runs/handoff-{timestamp}.json`
- `claimedBy` field on task.json
- Handoff chain display in TaskDetail
- Updated MCP task detail resource
- `test/handoff-protocol.test.js`
- All existing tests pass

## Acceptance Criteria

- Agent A calls workflow_handoff → handoff record written, task released
- Agent B calls workflow_pickup → gets full context, task claimed by B
- Handoff chain visible in dashboard TaskDetail
- Evidence from both agents appears in same task timeline
- MCP task detail resource includes handoffRecords and claimedBy
- `npm test`, `npm run smoke`, `npm run lint` pass

## Risks

- Pickup without prior handoff should still work (agent claims a fresh todo task)
- Multiple rapid handoffs should not corrupt state — each handoff is append-only
- claimedBy must be cleared on handoff to allow pickup by any agent
