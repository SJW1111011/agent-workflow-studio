# T-301 Context

## Why now

The dashboard currently polls `GET /api/tasks/{taskId}/execution` and `GET .../logs/{stream}` to show execution progress. This is laggy (poll interval) and wasteful (repeated full reads). SSE enables real-time updates for both the dashboard (Phase 4) and future MCP resource subscriptions. It's a prerequisite for a responsive control plane.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `dashboard-execution.js` already tracks execution state per-task in memory with status transitions
- `run-executor.js` writes stdout/stderr to log files via file handles opened at spawn time
- SSE is built into HTTP — just set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and write `data: ...\n\n` lines
- No external dependency needed — Node.js `http` module supports SSE natively
- The dashboard frontend (`dashboard/app.js`) currently polls via `setInterval` + `fetch`

## Open questions

- Should log streaming use `fs.watchFile` (polling) or `fs.watch` (inotify/FSEvents)? `fs.watch` is faster but less reliable on some platforms. Leaning `fs.watch` with `fs.watchFile` fallback.
- Should SSE events include a sequence number for resume-after-disconnect? Leaning no for v1 — keep it simple.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Can run in parallel with T-300 (MCP Server)
- No external dependencies
- Must not break existing polling endpoints
- Must pass `npm test`, `npm run lint`, `npm run smoke`
