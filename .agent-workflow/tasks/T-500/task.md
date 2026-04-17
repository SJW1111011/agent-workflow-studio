# T-500 - Vite + Preact scaffold — build pipeline, dev server, component shell replacing vanilla HTML

## Goal

Set up the Vite + Preact build pipeline and create a minimal component shell that replaces the current vanilla `dashboard/index.html` + script tags. After this task, `npm run dashboard:dev` starts a Vite dev server with HMR, `npm run dashboard:build` produces a production bundle, and the existing `src/server.js` serves the built output. The shell renders the same 5-tab layout with placeholder content — no feature migration yet.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/ (new — Vite + Preact project root)
  - repo path: dashboard-next/vite.config.js
  - repo path: dashboard-next/package.json (Preact, Vite as devDeps)
  - repo path: dashboard-next/src/main.jsx (entry point)
  - repo path: dashboard-next/src/App.jsx (tab shell component)
  - repo path: dashboard-next/src/components/ (Tab, Layout, Header stubs)
  - repo path: dashboard-next/src/styles/ (CSS variables migrated from dashboard/styles.css)
  - repo path: dashboard-next/index.html (Vite HTML entry)
  - repo path: src/server.js (serve dashboard-next/dist/ when available, fallback to dashboard/)
  - repo path: package.json (add dashboard:dev and dashboard:build scripts)
  - repo path: .gitignore (add dashboard-next/dist/)
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/ (old dashboard preserved as fallback — not deleted)
  - repo path: Component migration (T-501)
  - repo path: SSE integration (T-502)
  - repo path: Dark mode (T-503)

## Deliverables

- `dashboard-next/` directory with Vite + Preact project
- `vite.config.js` with Preact plugin, proxy to API server, build output to `dashboard-next/dist/`
- Minimal component shell: Header, TabBar, 5 tab panels (Overview, Tasks, Actions, Verification, Runs) with placeholder text
- CSS variables from current `dashboard/styles.css` migrated to `dashboard-next/src/styles/variables.css`
- `src/server.js` updated: serves `dashboard-next/dist/` if it exists, otherwise falls back to `dashboard/`
- `npm run dashboard:dev` starts Vite dev server on port 5173 with API proxy to 4173
- `npm run dashboard:build` produces production bundle
- Old `dashboard/` preserved and still works via `--legacy-dashboard` flag or when dist/ doesn't exist

## Risks

- Vite dev server port conflict with existing dashboard server (4173) — use 5173 for Vite, proxy API calls
- Preact + Vite are devDeps for the dashboard, but the built output is static — no runtime dep for end users
- `src/server.js` must detect which dashboard to serve without breaking existing behavior

## Acceptance Criteria

- `npm run dashboard:dev` starts Vite dev server with HMR, shows 5-tab shell
- `npm run dashboard:build` produces `dashboard-next/dist/` with index.html + JS + CSS
- `npx agent-workflow dashboard` serves the new dashboard when dist/ exists
- `npx agent-workflow dashboard --legacy-dashboard` serves the old vanilla dashboard
- Old `dashboard/` directory untouched
- `npm test` passes (no test changes needed — dashboard has no unit tests yet)
- `npm run lint` passes
- `npm run smoke` passes
