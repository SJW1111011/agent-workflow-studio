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
  - repo path: src/server.js
  - repo path: src/lib/dashboard-execution.js
  - repo path: src/lib/run-executor.js
  - repo path: test/server-api.test.js
  - repo path: test/run-executor.test.js
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/ (frontend SSE consumption deferred to Phase 4)
  - repo path: src/mcp-server.js (MCP resource subscriptions are a follow-up)
  - repo path: WebSocket (SSE is sufficient and simpler)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 2 context)

## Deliverables

- `GET /api/tasks/{taskId}/execution/logs/{stream}/stream` SSE endpoint that emits `data:` events for live log lines
- `GET /api/tasks/{taskId}/execution/events` SSE endpoint that emits execution state updates (`{status, outcome, updatedAt}`)
- Event emitter integration in `src/lib/dashboard-execution.js` for execution-state transitions and live log subscriptions
- Real-time stdout/stderr fan-out in `src/lib/run-executor.js` so execution logs still persist to files while live line events are emitted to SSE subscribers
- Existing polling endpoints unchanged (backward compatible)
- Unit tests for SSE endpoints and executor log fan-out
- README updates that document both snapshot and SSE execution routes

## Risks

- Long-lived SSE connections may leak if clients disconnect without closing, so the server must clean up listeners on `request.on("close")`
- Streaming must preserve the existing on-disk log files because polling endpoints and run evidence still depend on them
- Multiple concurrent SSE connections for the same task must work without cross-talk or listener leaks

## Acceptance Criteria

- `curl -N http://localhost:4173/api/tasks/T-001/execution/logs/stdout/stream` receives real-time log lines during execution
- SSE events conform to `text/event-stream` format with proper `data:` lines and `\n\n` delimiters
- Connection cleanup on client disconnect avoids resource leaks
- Existing polling endpoints still work with no behavior regression
- `npm test` passes with the new tests
