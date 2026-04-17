# T-504 Context

## Why now

The current dashboard shows tasks as a flat list. With 20+ tasks (this project already has 24), the list becomes hard to scan. Kanban gives status-at-a-glance, timeline gives temporal context. These are the views that make the dashboard a real project management surface instead of a task dump.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current task list: flat, filterable by executor outcome, shows coverage bar and verification signal
- Task statuses: todo, in_progress, done — natural kanban columns
- task.json has `createdAt` and `updatedAt` timestamps — timeline axis data
- Run records have timestamps — can be plotted as dots on the timeline
- This project has 24 tasks across 4 phases — good test data for multi-task views

## Open questions

- Should kanban support drag-and-drop to change status? Leaning no for v1 — click to open detail, use form to change status.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-501 (components) and T-503 (dark mode — views must work in both themes)
- No external dependencies for drag-and-drop
- Must pass `npm run dashboard:build`
