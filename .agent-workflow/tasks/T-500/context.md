# T-500 Context

## Why now

The current dashboard is 14 vanilla JS files using global state, string-based rendering, and script-tag modules. That architecture blocks the next UI phase. This scaffold task lands the Vite + Preact build pipeline, keeps the warm-beige design language, and preserves the legacy dashboard as the truthful fallback so later migration tasks can move real features without first reinventing the toolchain.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current dashboard: 14 files, ~4,472 lines JS + 884 lines CSS, zero build step
- Tab-based routing already exists across 5 sections: overview, tasks, actions, verification, and runs
- `dashboard-next/` now contains a minimal Vite + Preact shell with Header, TabBar, layout wrapper, and placeholder content for those 5 tabs
- `dashboard-next/src/styles/variables.css` carries forward the legacy warm-beige CSS variables, while `app.css` trims the layout down to scaffold-only panels
- Root scripts now expose `npm run dashboard:dev` and `npm run dashboard:build`, backed by repo-level Vite and Preact dev dependencies plus a nested `dashboard-next/package.json` manifest
- `src/server.js` now serves `dashboard-next/dist/` when `index.html` exists and falls back to `dashboard/` when it does not or when `--legacy-dashboard` is passed
- Smoke coverage now forces `--legacy-dashboard` so the feature-complete legacy UI still owns workflow mutation checks while the scaffold remains placeholder-only
- Added test coverage for the new CLI help surface and the server's modern-vs-legacy asset selection path
- Verified on 2026-04-17: `npm run dashboard:build`, `npm run lint`, `npm test`, and `npm run smoke` all passed; live checks confirmed the built shell, legacy fallback, Vite dev server on `127.0.0.1:5173`, and `/api/health` proxying back to `127.0.0.1:4173`

## Open questions

- When the real feature migration lands, should the built `dashboard-next/dist/` bundle start shipping in the published package by default, or stay repo-local until the new shell reaches parity?
- When should the README switch its primary dashboard instructions from the legacy control plane to the new shell workflow?

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Old dashboard must remain functional as fallback
- Preact and Vite are devDeps only - no runtime deps for CLI users
- Must not break any existing CLI, API, or test behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`
- Keep the new shell honest: no fake data migration, no hidden API contract changes, and no removal of the legacy dashboard before later tasks port the real features
