# T-503 Runtime Check - 2026-04-18

## Commands

- `npm run lint` -> passed
- `npm run dashboard:build` -> passed
- `npm test` -> passed (`34` test files, `170` tests)
- `npm run smoke` -> passed

## Build output

- `dashboard-next/dist/index.html` -> `2.01 kB` (`0.92 kB` gzip)
- `dashboard-next/dist/assets/index-piuoqp43.css` -> `22.53 kB` (`5.16 kB` gzip)
- `dashboard-next/dist/assets/index-DWpwS8MZ.js` -> `106.92 kB` (`28.75 kB` gzip)

## Served shell check

- Verified `http://127.0.0.1:4273/` served the modern title `Agent Workflow Studio Dashboard`
- Verified the built HTML includes `meta[name="viewport"]`, `meta[name="theme-color"]`, `meta[name="description"]`, and the inline theme bootstrap script
- Verified the favicon 404 regression is gone on the final Lighthouse rerun

## Lighthouse mobile

- Initial run (`.agent-workflow/tasks/T-503/lighthouse-mobile-20260418.json`) -> performance `84`, accessibility `100`, best practices `96`, SEO `100`
- Initial regression notes:
  - `section.stats` caused a `0.251519` layout shift because it appeared after the initial overview panel
  - `favicon.ico` returned `404`, which failed the console-error audit
- Final run (`.agent-workflow/tasks/T-503/lighthouse-mobile-20260418-rerun.json`) -> performance `98`, accessibility `100`, best practices `100`, SEO `100`
- Final audit notes:
  - `viewport` passed
  - `font-size` passed with `100% legible text`
  - `color-contrast` passed
  - console errors: none
  - remaining weighted performance audits below perfect: `First Contentful Paint 1.8 s`, `Largest Contentful Paint 1.9 s`

## Notes

- Direct `msedge --screenshot` capture failed on this machine with a local crashpad permission error, so the browser-side artifact for this task is the Lighthouse JSON report rather than a standalone Edge screenshot.
