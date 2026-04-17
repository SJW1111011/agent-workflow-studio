# T-500 Context

## Why now

The current dashboard is 14 vanilla JS files (~4,500 lines) using global state, string-based HTML rendering, and UMD modules loaded via script tags. This architecture cannot support dark mode, real-time SSE updates, or multi-task views without a rewrite. Vite + Preact provides component model, HMR, and a build pipeline while keeping the bundle small (~3KB Preact runtime). This scaffold task is the foundation — all other Phase 4 tasks build on it.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current dashboard: 14 files, ~4,472 lines JS + 884 lines CSS, zero build step
- Tab-based routing with 5 tabs: overview, tasks, actions, verification, runs
- State managed via global variables (activeTaskId, activeTaskDetail, etc.)
- Rendering via string concatenation (renderTaskCard returns HTML string)
- Polling via setTimeout (900ms interval) — SSE endpoints exist but unused
- Design system: warm beige palette, CSS variables, 24px radius, responsive at 900px
- `src/server.js` serves dashboard files statically from `dashboard/` directory
- Preact is ~3KB gzipped — minimal bundle overhead
- Vite supports Preact via `@preact/preset-vite` plugin

## Open questions

- Should the new dashboard live in `dashboard-next/` or replace `dashboard/` directly? Leaning `dashboard-next/` to allow parallel development and fallback.
- Should we use CSS Modules, Tailwind, or keep vanilla CSS? Leaning vanilla CSS with CSS variables — matches existing design system, no extra deps.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Old dashboard must remain functional as fallback
- Preact and Vite are devDeps only — no runtime deps for CLI users
- Must not break any existing CLI, API, or test behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`
