# T-603 - Agent Activity Evidence

## Goal

Let agents report what they did as structured evidence through MCP tool calls. Add a `workflow_record_activity` MCP tool for incremental activity logging, and extend `workflow_done` with an optional `evidenceContext` field that captures files modified, commands run, and session metadata.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/mcp-tools.js (add workflow_record_activity tool, extend workflow_done with evidenceContext)
  - repo path: src/lib/task-service.js (store activity records, merge evidenceContext into run)
  - repo path: src/server.js (expose activity records in task detail API)
  - repo path: test/agent-activity-evidence.test.js (new tests)
- Out of scope:
  - repo path: dashboard-next/ (T-604 handles dashboard display)

## Design

### workflow_done extension

Add optional `evidenceContext` object to `workflow_done` input schema:
- `filesModified`: string[] — files the agent changed
- `commandsRun`: string[] — commands the agent executed
- `toolCallCount`: number — how many tool calls the agent made
- `sessionDurationMs`: number — how long the agent worked

When `evidenceContext.filesModified` is provided and `proofPaths` is not, auto-populate `proofPaths` from `filesModified`. Store `evidenceContext` in the run record alongside existing evidence fields.

### workflow_record_activity (new MCP tool, 11th tool)

Input: `{ taskId, activity, filesModified?, metadata? }`

Creates a timestamped activity record at `runs/activity-{timestamp}.json`. Activity records are lightweight breadcrumbs — they don't trigger checkpoint refresh or status change.

### Task detail API

`GET /api/tasks/:taskId` response includes `activityRecords[]` alongside `runs[]`.

## Deliverables

- Updated `mcp-tools.js` with `workflow_record_activity` and `evidenceContext` on `workflow_done`
- Updated `task-service.js` with activity record storage and evidenceContext merging
- Updated `server.js` to include activity records in task detail
- `test/agent-activity-evidence.test.js` with tests
- All existing tests pass unchanged

## Acceptance Criteria

- `workflow_done` with `evidenceContext` produces richer run record
- `workflow_record_activity` creates timestamped activity files in `runs/`
- Activity records appear in task detail API response
- Agents that don't use `evidenceContext` produce identical results to today
- MCP tool list shows 11 tools
- `npm test` passes

## Risks

- Activity records could accumulate — consider a cap or cleanup policy in follow-up
- `evidenceContext` schema must be validated to prevent arbitrary data injection
