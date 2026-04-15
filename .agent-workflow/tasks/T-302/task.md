# T-302 - Bidirectional task updates — agents can update task status and append notes mid-execution

## Goal

Enable agents to update task metadata and append progress notes during execution, not just at the end. Add MCP tools (`workflow_update_task`, `workflow_append_note`) and corresponding HTTP endpoints that let an agent mark a task as blocked, update priority, or log intermediate observations without waiting for the run to complete. This makes the workflow layer a live collaboration surface instead of a post-hoc recording system.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/mcp-tools.js (add `workflow_update_task` and `workflow_append_note` tools)
  - repo path: src/mcp-server.js (register new tools)
  - repo path: src/lib/task-service.js (add `appendTaskNote` function)
  - repo path: src/lib/task-documents.js (append note to context.md or a new notes section)
  - repo path: src/server.js (add `POST /api/tasks/{taskId}/notes` endpoint)
  - repo path: test/mcp-tools.test.js (test new tools)
  - repo path: test/task-service.test.js (test appendTaskNote)
  - repo path: README.md (document new MCP tools)
- Out of scope:
  - repo path: dashboard/ (UI for notes display deferred to Phase 4)
  - repo path: src/lib/run-executor.js (execution flow unchanged)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 2 context)

## Deliverables

- `workflow_update_task` MCP tool — update status, priority, title on a task
- `workflow_append_note` MCP tool — append a timestamped note to task context
- `appendTaskNote(workspaceRoot, taskId, note)` in task-service.js
- `POST /api/tasks/{taskId}/notes` HTTP endpoint
- Unit tests for new tools and functions
- Documentation

## Risks

- Notes appended during execution could conflict with checkpoint refresh — append to a separate `## Progress notes` section in context.md to avoid managed block conflicts
- Rapid note appends could cause file write contention — acceptable for single-agent workflows
- Status updates during execution could conflict with auto-status transitions — use the same one-way-only rule (never regress)

## Acceptance Criteria

- From Claude Code via MCP: "update T-001 priority to P0" triggers `workflow_update_task`
- From Claude Code via MCP: "note on T-001: found a race condition in auth" triggers `workflow_append_note`
- Notes are appended to context.md with ISO timestamp
- Status updates respect the one-way rule (never regress `done` → `in_progress`)
- `npm test` passes with new tests
