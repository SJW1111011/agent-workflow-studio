# T-502 - SSE real-time updates — replace 900ms polling with EventSource subscriptions

## Goal

Replace the dashboard's 900ms setTimeout polling with SSE EventSource subscriptions for execution state and log streaming. After this task, execution progress updates appear instantly in the UI without polling, and log output streams in real-time. The SSE endpoints from T-301 are already on the server — this task connects the Preact dashboard to them.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/hooks/useExecutionSSE.js (new — EventSource hook for execution state)
  - repo path: dashboard-next/src/hooks/useLogSSE.js (new — EventSource hook for log streaming)
  - repo path: dashboard-next/src/components/ExecutionPanel.jsx (consume SSE hooks instead of polling)
  - repo path: dashboard-next/src/context/DashboardContext.jsx (remove polling logic)
- Out of scope:
  - repo path: src/server.js (SSE endpoints already exist from T-301)
  - repo path: dashboard/ (old dashboard unchanged)

## Deliverables

- `useExecutionSSE(taskId)` hook: connects to `/api/tasks/{taskId}/execution/events`, returns live execution state, auto-reconnects on disconnect
- `useLogSSE(taskId, stream)` hook: connects to `/api/tasks/{taskId}/execution/logs/{stream}/stream`, returns live log lines, auto-reconnects
- ExecutionPanel uses SSE hooks — no more setTimeout polling
- Graceful fallback: if SSE connection fails, fall back to polling
- Connection cleanup on component unmount (no resource leaks)

## Risks

- SSE connections may not work through some corporate proxies — fallback to polling mitigates this
- Multiple rapid task selections could create orphaned EventSource connections — cleanup on taskId change
- Browser EventSource auto-reconnects on error — may cause rapid reconnection loops if server is down

## Acceptance Criteria

- Execution state updates appear in UI within 1 second of server-side change (no 900ms poll delay)
- Log output streams in real-time during execution
- Switching tasks closes old SSE connections and opens new ones
- Component unmount closes all SSE connections
- Fallback to polling if SSE fails
- No resource leaks (check browser DevTools Network tab)
