# T-500 Verification

## Draft checks

- automated: `npm run dashboard:build`
- automated: `npm run lint`
- automated: `npm test`
- automated: `npm run smoke`
- manual: start `node src/server.js --root . --port 4176` after the build and confirm `/` serves the built shell
- manual: start `node src/server.js --root . --port 4177 --legacy-dashboard` and confirm the legacy script-tag dashboard still loads
- manual: start `node src/server.js --root . --port 4173 --legacy-dashboard` plus `npm run dashboard:dev -- --host 127.0.0.1`, then confirm `http://127.0.0.1:5173/` serves the Vite client and `/api/health` proxies through

## Verification records

### Record 1

- Files: .gitignore, README.md, docs/ARCHITECTURE.md, eslint.config.mjs, package.json, package-lock.json, scripts/smoke-test.js, src/cli.js, src/server.js, test/cli.test.js, test/server-static-dashboard.test.js, dashboard-next/index.html, dashboard-next/package.json, dashboard-next/vite.config.js, dashboard-next/src/App.jsx, dashboard-next/src/main.jsx, dashboard-next/src/components/Header.jsx, dashboard-next/src/components/Layout.jsx, dashboard-next/src/components/TabBar.jsx, dashboard-next/src/components/TabButton.jsx, dashboard-next/src/styles/app.css, dashboard-next/src/styles/variables.css
- Check: `npm run dashboard:build`; `npm run lint`; `npm test`; `npm run smoke`; live server checks for built-shell default, `--legacy-dashboard` fallback, and Vite dev-server proxying
- Result: passed
- Artifact: dashboard-next/dist/index.html; .agent-workflow/tasks/T-500/runs/runtime-check-20260417.md

## Blocking gaps

- Feature migration is intentionally still open: the new shell proves the pipeline and layout only, while the legacy dashboard remains the truthful workflow UI.

## Evidence 2026-04-17T14:01:05.893Z

- Agent: manual
- Status: passed
- Scoped files covered: .gitignore, README.md, docs/ARCHITECTURE.md, eslint.config.mjs, package.json, package-lock.json, scripts/smoke-test.js, src/cli.js, src/server.js, test/cli.test.js, test/server-static-dashboard.test.js, dashboard-next/index.html, dashboard-next/package.json, dashboard-next/vite.config.js, dashboard-next/src/App.jsx, dashboard-next/src/main.jsx, dashboard-next/src/components/Header.jsx, dashboard-next/src/components/Layout.jsx, dashboard-next/src/components/TabBar.jsx, dashboard-next/src/components/TabButton.jsx, dashboard-next/src/styles/app.css, dashboard-next/src/styles/variables.css
- Verification artifacts: dashboard-next/dist/index.html, .agent-workflow/tasks/T-500/runs/runtime-check-20260417.md
- Proof artifacts: dashboard-next/dist/index.html, .agent-workflow/tasks/T-500/runs/runtime-check-20260417.md
- Summary: Delivered the Vite + Preact dashboard scaffold with legacy fallback, validation coverage, and live runtime checks.
- Verification check: [passed] npm run dashboard:build
- Verification check: [passed] npm run lint
- Verification check: [passed] npm test
- Verification check: [passed] npm run smoke
- Verification check: [passed] verified built dashboard default server response after dist generation
- Verification check: [passed] verified legacy dashboard fallback with --legacy-dashboard
- Verification check: [passed] verified vite dev server startup and /api/health proxy
