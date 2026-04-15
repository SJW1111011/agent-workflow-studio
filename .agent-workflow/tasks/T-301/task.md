# T-301 - SSE streaming for execution logs — replace file polling with server-sent events

## Goal

Add SSE (Server-Sent Events) endpoints to the HTTP dashboard server so clients can subscribe to real-time execution log streams and task state changes instead of polling. The dashboard frontend and MCP resource subscriptions can both consume these streams. This replaces the current `GET /api/tasks/{taskId}/execution/logs/{stream}?maxChars=N` polling pattern with a push model.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/server.js (add SSE endpoints)
  - repo path: src/lib/dashboard-execution.js (add event emitter for state changes and log writes)
  - repo path: src/lib/run-executor.js (emit log events during execution)
  - repo path: test/server-api.test.js (add SSE endpoint tests)
  - repo path: README.md (document SSE endpoints)
- Out of scope:
  - repo path: dashboard/ (frontend SSE consumption deferred to Phase 4)
  - repo path: src/mcp-server.js (MCP resource subscriptions are a follow-up)
  - repo path: WebSocket (SSE is sufficient and simpler)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 2 context)

## Deliverables

- `GET /api/tasks/{taskId}/execution/logs/{stream}/stream` — SSE endpoint, sends `data: {line}` events as log lines arrive
- `GET /api/tasks/{taskId}/execution/events` — SSE endpoint, sends state change events (`{status, outcome, updatedAt}`)
- Event emitter integration in `dashboard-execution.js` for state transitions
- File watcher or tail-follow integration in `run-executor.js` for log streaming
- Existing polling endpoints unchanged (backward compatible)
- Unit tests for SSE endpoints

## Risks

- Long-lived SSE connections may leak if clients disconnect without closing — use `request.on('close')` cleanup
- File watching on Windows may have latency — use `fs.watchFile` with short interval as fallback
- Multiple concurrent SSE connections for same task must work — EventEmitter supports multiple listeners

## Acceptance Criteria

- `curl -N http://localhost:4173/api/tasks/T-001/execution/logs/stdout/stream` receives real-time log lines during execution
- SSE events conform to `text/event-stream` format with proper `data:` lines and `\n\n` delimiters
- Connection cleanup on client disconnect (no resource leaks)
- Existing polling endpoints still work (no regression)
- `npm test` passes with new tests
