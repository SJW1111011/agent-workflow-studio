# T-301 Context

## Why now

The dashboard currently polls `GET /api/tasks/{taskId}/execution` and `GET .../logs/{stream}` to show execution progress. This is laggy because clients wait for the next poll interval, and it is wasteful because every refresh rereads the current state from disk. SSE gives Phase 2 a simple push channel that the future dashboard and MCP subscriptions can both reuse.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `src/lib/dashboard-execution.js` already owns the in-memory dashboard execution state and is the narrowest place to emit task-level state transitions.
- `src/lib/run-executor.js` currently writes stdout/stderr directly to log files when `stdioMode === "pipe"`.
- Dashboard execution already requires adapter `stdioMode: "pipe"`, which gives the executor one reliable place to tee live output while preserving the current log files.
- `test/server-api.test.js` already boots the real local HTTP server, so SSE coverage can stay inside the existing API test suite.
- No external dependency is needed because Node's built-in `http`, `events`, and child-process streams are enough for SSE plus live log fan-out.

## Open questions

- Log streaming will tee child stdout/stderr through Node, write the same bytes to the existing log files, and emit line-based events from that single source of truth.
- SSE events will stay v1-simple with no resume cursor or sequence number; reconnect behavior can still fall back to the existing snapshot endpoints.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Can run in parallel with T-300 (MCP Server)
- No external dependencies
- Must not break existing polling endpoints
- Must pass `npm test`, `npm run lint`, `npm run smoke`
