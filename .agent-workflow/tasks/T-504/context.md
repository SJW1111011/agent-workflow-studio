# T-504 Context

## Why now

The current dashboard shows tasks as a flat list. With 20+ tasks already present in this repository, the list becomes hard to scan. Kanban gives status-at-a-glance, timeline gives temporal context, and together they make the dashboard feel like a real project-management surface instead of a task dump.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `dashboard-next/src/components/TaskList.jsx` already owns executor outcome filtering and task selection.
- Overview data already exposes both `tasks` and top-level `runs`, so kanban and timeline can stay client-side.
- Task metadata includes `createdAt` / `updatedAt`, and run records include timestamps that can render as timeline dots.
- Theme persistence and responsive tokens already exist in `dashboard-next`, so the new views should reuse that surface instead of inventing parallel styling.
- This repository already has enough tasks to make list-only scanning noisy, which gives the new views meaningful built-in test data.

## Open questions

- Should drag-and-drop status mutation be added later? Keep it out of scope for this slice unless product direction changes.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-501 (components) and T-503 (dark mode; views must work in both themes)
- No external dependencies for drag-and-drop
- No server or API changes for v1
- Must pass `npm run lint`, `npm run dashboard:build`, and `npm test`
