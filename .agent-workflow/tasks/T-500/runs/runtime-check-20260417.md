# T-500 Runtime Check

Date: 2026-04-17

## Commands

- `npm run dashboard:build`
- `npm run lint`
- `npm test`
- `npm run smoke`

## Live probes

- Default server on `http://127.0.0.1:4176/` served the built shell and included `<div id="app"></div>`.
- Legacy server on `http://127.0.0.1:4177/` served the existing script-tag dashboard and still referenced `/document-helpers.js`.
- Vite dev server started on `http://127.0.0.1:5173/` from `npm run dashboard:dev -- --host 127.0.0.1`.
- The dev server proxied `http://127.0.0.1:5173/api/health` back to the local API server on `http://127.0.0.1:4173`.

## Results

- `defaultServesModern`: true
- `legacyServesScriptTags`: true
- `devServesViteClient`: true
- `devProxyHealthOk`: true
