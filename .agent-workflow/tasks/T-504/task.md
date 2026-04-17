# T-504 - Multi-task views — kanban board and timeline view alongside existing list

## Goal

Add kanban board and timeline views as alternatives to the existing task list. Users can switch between list, kanban, and timeline views via a view selector. Kanban groups tasks by status (todo / in_progress / done) with drag-and-drop. Timeline shows tasks on a horizontal axis ordered by creation date with run markers. This makes the dashboard useful for managing 10+ tasks at a glance.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/components/TaskKanban.jsx (new — kanban board)
  - repo path: dashboard-next/src/components/TaskTimeline.jsx (new — timeline view)
  - repo path: dashboard-next/src/components/ViewSelector.jsx (new — list/kanban/timeline toggle)
  - repo path: dashboard-next/src/components/TaskList.jsx (integrate with ViewSelector)
  - repo path: dashboard-next/src/styles/ (kanban and timeline styles)
- Out of scope:
  - repo path: Gantt chart (too complex for v1 — defer to Phase 6)
  - repo path: Drag-and-drop status change (nice-to-have, not required for v1)
  - repo path: src/ (no server changes)

## Deliverables

- ViewSelector component: list | kanban | timeline toggle, persisted in localStorage
- TaskKanban: 3 columns (todo, in_progress, done), task cards with coverage bar and verification signal
- TaskTimeline: horizontal timeline with task markers, run dots, date axis
- All views respond to the same filter (executor outcome filter)
- Responsive: kanban stacks vertically on mobile, timeline scrolls horizontally

## Risks

- Kanban with many tasks per column may need virtual scrolling — defer to follow-up if needed
- Timeline date axis needs careful scaling for projects with tasks spanning weeks vs hours
- Drag-and-drop adds complexity — explicitly out of scope for v1

## Acceptance Criteria

- View selector toggles between list, kanban, and timeline
- Kanban shows tasks grouped by status with correct counts
- Timeline shows tasks ordered by creation date
- Clicking a task in any view opens the detail panel
- View preference persists across page reloads
- All views work on mobile viewport (375px)
- `npm run dashboard:build` succeeds
