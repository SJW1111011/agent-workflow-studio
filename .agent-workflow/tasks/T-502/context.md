# T-502 Context

## Why now

T-301 built the SSE server endpoints. T-501 built the Preact components. This task connects them. The current 900ms polling is the biggest UX gap — users see stale execution state for up to a second after each change. SSE makes the dashboard feel live.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- SSE endpoints from T-301: `GET /api/tasks/{taskId}/execution/events` and `GET /api/tasks/{taskId}/execution/logs/{stream}/stream`
- Browser `EventSource` API handles reconnection automatically
- Preact `useEffect` cleanup function is the right place to close EventSource
- Current polling: `scheduleExecutionPolling(taskId, 900)` → `pollExecutionState(taskId)` → setTimeout loop

## Open questions

- Should SSE hooks buffer events or apply them immediately? Leaning immediate — execution state changes are infrequent enough.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-500 (scaffold) and T-501 (components)
- Must not break server-side SSE endpoints
- Must handle disconnection gracefully
