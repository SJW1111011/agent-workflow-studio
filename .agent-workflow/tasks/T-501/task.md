# T-501 - Component migration - convert all render-helpers to Preact JSX components with hooks state

## Goal

Convert the placeholder Vite shell into the real Preact dashboard without breaking the existing workflow contract. After this task, the five dashboard tabs render live API data through reducer-backed state, the actions/forms/document editor all work as controlled components, execution and log views stay usable, and the legacy `dashboard/` remains the preserved fallback.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/App.jsx
  - repo path: dashboard-next/src/components/Overview.jsx
  - repo path: dashboard-next/src/components/TaskList.jsx
  - repo path: dashboard-next/src/components/TaskDetail.jsx
  - repo path: dashboard-next/src/components/ExecutionPanel.jsx
  - repo path: dashboard-next/src/components/Forms.jsx
  - repo path: dashboard-next/src/components/DocumentEditor.jsx
  - repo path: dashboard-next/src/hooks/useApi.js
  - repo path: dashboard-next/src/hooks/useDashboardState.js
  - repo path: dashboard-next/src/context/DashboardContext.jsx
  - repo path: dashboard-next/src/utils/
  - repo path: dashboard-next/src/main.jsx
  - repo path: dashboard-next/src/styles/app.css
  - repo path: dashboard-next/vite.config.js
- Out of scope:
  - repo path: dashboard/
  - repo path: SSE integration (T-502)
  - repo path: Dark mode (T-503)
  - repo path: Multi-task views (T-504)

## Deliverables

- All 5 tab views rendered as Preact components with live API data
- DashboardContext with useReducer managing active task/tab selection, overview/task detail payloads, execution state, and log state
- `useApi` hook wrapping fetch calls with loading/error tracking
- Pure utility functions extracted into `dashboard-next/src/utils/` as native ESM modules
- Controlled forms for quick create, task metadata, run recording, execution actions, and document saves
- Production bundle emitted successfully by `npm run dashboard:build`

## Risks

- Feature parity is hard to verify without visual regression testing - mitigate with shared CSS/layout reuse plus automated build/test/smoke evidence
- Some vanilla helpers used `innerHTML` patterns that needed JSX conversion without `dangerouslySetInnerHTML`
- Document editor logic is the most complex part of the migration because it merges managed blocks with free-form markdown editing

## Acceptance Criteria

- All 5 tabs render correctly with real data from the API
- Task selection, filtering, and form submission all work
- Execution state displays correctly for active and completed runs
- Log panels open and show execution or run output
- Document editor loads and saves `task.md`, `context.md`, and `verification.md`
- `npm run dashboard:build` succeeds
- No `dangerouslySetInnerHTML` usage is required for the migrated views
- Old `dashboard/` still works via `--legacy-dashboard`
