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

## Open questions

- Should notes go in context.md or a separate notes.md? Leaning context.md `## Progress notes` section to keep file count low.
- Should `workflow_update_task` wrap the existing PATCH endpoint or call `updateTaskMeta` directly? Leaning direct call for consistency with other MCP tools.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-300 (MCP Server must exist for new tools to be registered)
- Must not break existing PATCH /api/tasks/{taskId} behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`
