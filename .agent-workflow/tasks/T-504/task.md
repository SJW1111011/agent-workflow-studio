# T-504 - Multi-task views: kanban board and timeline view alongside existing list

## Goal

Add list, kanban, and timeline task browsing to the modern dashboard so users can manage 10+ tasks without losing the existing detail workflow. The dashboard should let users switch views with one shared selector, keep the executor outcome filter applied across all views, persist the chosen view across reloads, and keep task cards clickable so task detail still opens from any view.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/components/TaskList.jsx (integrate selector, shared filter, and alternate task views)
  - repo path: dashboard-next/src/components/ViewSelector.jsx (new persisted list/kanban/timeline toggle)
  - repo path: dashboard-next/src/components/TaskKanban.jsx (new status-grouped board)
  - repo path: dashboard-next/src/components/TaskTimeline.jsx (new creation-date and run-activity timeline)
  - repo path: dashboard-next/src/utils/taskViews.js (shared task-view grouping and timeline helpers)
  - repo path: dashboard-next/src/styles/app.css (view selector, kanban, and timeline styling)
  - repo path: test/dashboard-next-task-views.test.js (task-view utility coverage)
- Out of scope:
  - repo path: src/ (no server or API changes for v1)
  - repo path: drag-and-drop status mutation (defer to a follow-up task)
  - repo path: gantt-style planning or dependency views

## Deliverables

- ViewSelector component: list | kanban | timeline toggle, persisted in localStorage
- TaskKanban: 3 columns (todo, in_progress, done), task cards with coverage bar and verification signal
- TaskTimeline: horizontal timeline with task markers, run dots, and date axis
- All views respond to the same filter (executor outcome filter)
- Responsive: kanban stacks vertically on mobile, timeline scrolls horizontally

## Risks

- Kanban with many tasks per column may need virtual scrolling in a follow-up
- Timeline date axis needs careful scaling for projects with tasks spanning weeks vs hours
- Browser-only behavior such as persistence and mobile layout still needs manual UI verification

## Acceptance Criteria

- View selector toggles between list, kanban, and timeline
- Kanban shows tasks grouped by status with correct counts
- Timeline shows tasks ordered by creation date
- Clicking a task in any view opens the detail panel
- View preference persists across page reloads
- All views work on mobile viewport (375px)
- `npm run dashboard:build` succeeds
