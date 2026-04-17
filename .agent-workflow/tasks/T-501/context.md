# T-501 Context

## Why now

T-500 created the Vite + Preact scaffold with placeholder tabs. This task turns that shell into the real dashboard so the modern build can replace the default server response without regressing task actions, verification editing, or execution/log visibility.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The modern app now uses `DashboardContext` + `useReducer` to manage active tab/task selection, overview/task detail payloads, execution state, action status, and log panel state.
- Legacy helper logic was ported into native ESM utilities under `dashboard-next/src/utils/` because Vite could not bundle the old UMD helper files directly.
- The new app reuses `dashboard/styles.css` so the Preact implementation keeps the established layout and interaction affordances without copying the legacy DOM-string render path.
- Actions are implemented as controlled Preact forms for quick create, task creation, task metadata updates, run recording, execution start/cancel, and markdown document saves.
- Execution log polling remains timer-based in `useDashboardState`; SSE is still intentionally out of scope for T-502.
- Verification currently relies on build/lint/test/smoke evidence plus durable workflow artifacts; no browser-level visual regression suite exists yet.

## Open questions

- URL routing remains a follow-up. This task intentionally kept the existing tab-based navigation so the migration stayed within scope and did not introduce new routing/state contracts.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-500 (scaffold must exist)
- Feature parity with vanilla dashboard - no new features, no removed features
- Must pass `npm run dashboard:build`
