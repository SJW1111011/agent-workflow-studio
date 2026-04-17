# T-501 - Component migration — convert all render-helpers to Preact JSX components with hooks state

## Goal

Convert all 11 vanilla JS render-helper modules into Preact JSX components with hooks-based state management. After this task, the dashboard is fully functional in Preact — same features as the vanilla version but with component architecture, virtual DOM rendering, and centralized state via Context + useReducer. The old `dashboard/` directory can be archived.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/components/Overview.jsx (from overview-render-helpers.js)
  - repo path: dashboard-next/src/components/TaskList.jsx (from task-list-render-helpers.js + task-board-helpers.js)
  - repo path: dashboard-next/src/components/TaskDetail.jsx (from task-detail-helpers.js)
  - repo path: dashboard-next/src/components/ExecutionPanel.jsx (from execution-detail-helpers.js + log-panel-helpers.js)
  - repo path: dashboard-next/src/components/Forms.jsx (from form-state-helpers.js + form-event-helpers.js)
  - repo path: dashboard-next/src/components/DocumentEditor.jsx (from document-helpers.js)
  - repo path: dashboard-next/src/hooks/useApi.js (from api-client-helpers.js)
  - repo path: dashboard-next/src/hooks/useDashboardState.js (replaces global variables)
  - repo path: dashboard-next/src/context/DashboardContext.jsx (Context + useReducer)
  - repo path: dashboard-next/src/utils/ (pure logic extracted from helpers — filtering, parsing, formatting)
- Out of scope:
  - repo path: SSE integration (T-502)
  - repo path: Dark mode (T-503)
  - repo path: Multi-task views (T-504)
  - repo path: dashboard/ (old — preserved but not modified)

## Deliverables

- All 5 tab views rendered as Preact components with identical functionality to vanilla version
- DashboardContext with useReducer managing: activeTaskId, activeTab, overview, taskDetail, executionState, logState
- useApi hook wrapping fetch calls with loading/error states
- Pure utility functions extracted from helpers (no DOM dependency)
- Forms as controlled Preact components with onSubmit handlers
- Task list with filter, task detail with runs/execution/verification, overview with stats
- `npm run dashboard:build` produces working production bundle

## Risks

- Feature parity is hard to verify without visual regression testing — mitigate with manual side-by-side comparison
- Some vanilla helpers use innerHTML patterns that need careful JSX conversion (XSS risk if not escaped)
- Document editor (markdown parsing + managed blocks) is the most complex component — may need extra attention

## Acceptance Criteria

- All 5 tabs render correctly with real data from the API
- Task selection, filtering, form submission all work
- Execution state displays correctly (running, completed, failed)
- Log panel opens and shows execution output
- Document editor loads and saves task.md, context.md, verification.md
- `npm run dashboard:build` succeeds
- No XSS vulnerabilities (no dangerouslySetInnerHTML without sanitization)
- Old `dashboard/` still works via `--legacy-dashboard`
