# T-302 Context

## Why now

T-300 (MCP Server) gives agents read + create capabilities. But agents can't update tasks mid-flight — they must wait until `done` to record anything. For long-running tasks, intermediate progress notes and status changes are essential for observability and for handoffs between agents or sessions.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `updateTaskMeta()` in `task-service.js` already supports updating status, priority, title via PATCH
- `PATCH /api/tasks/{taskId}` HTTP endpoint exists and works
- context.md has free-form sections (Facts, Open questions) that could host notes
- T-204 established the one-way status transition rule: never regress automatically
- MCP tools return structured JSON results
- The implementation appends notes under a dedicated `## Progress notes` section in `context.md` so managed recipe and constraints blocks stay isolated.
- `workflow_update_task` now calls the shared `updateTaskMeta()` path directly and refreshes the checkpoint, matching other MCP tool behavior.
- `appendTaskNote()` now updates `task.json.updatedAt`, materializes `context.md` for lite tasks, and returns the appended note metadata for MCP/HTTP callers.
- Full verification passed on 2026-04-15: `npm test`, `npm run lint`, and `npm run smoke`.

## Open questions

- Resolved: notes live in `context.md` under `## Progress notes` to avoid extra task files and managed-block collisions.
- Resolved: `workflow_update_task` calls `updateTaskMeta()` directly, while the existing PATCH endpoint remains the HTTP surface for task metadata updates.

## Progress notes

### 2026-04-15T08:55:00.000Z

Implemented the MCP task-update and note-append flows, added the dedicated `/api/tasks/{taskId}/notes` endpoint, and finished focused plus repo-level verification.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-300 (MCP Server must exist for new tools to be registered)
- Must not break existing PATCH /api/tasks/{taskId} behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`
