# T-501 Runtime Check

Recorded: 2026-04-17

## Commands

- `npm run dashboard:build`
- `npm run lint`
- `npm test`
- `npm run smoke`

## Result

- All commands passed after the Preact dashboard migration landed.
- The production bundle was emitted to `dashboard-next/dist/`.
- Lint stayed clean across the new `dashboard-next` JSX and utility files.
- The full Vitest suite passed.
- The smoke test passed.

## Notes

- The first build attempt inside the sandbox failed with `spawn EPERM` while Vite tried to launch `esbuild`; rerunning the build outside the sandbox confirmed the app compiled successfully.
- The migration kept the legacy `dashboard/` code untouched and moved the new app onto native ESM utilities because Vite could not bundle the old UMD helper files directly.
