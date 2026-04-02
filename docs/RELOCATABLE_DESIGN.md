# Relocatable Design

This project is expected to move directories later, so relocatability is a design constraint, not a bonus.

## Rules

1. Never persist absolute machine paths in generated workflow files.
2. Always resolve the target repository from `--root` or `process.cwd()`.
3. Keep all tool-owned state inside the target repository or inside the tool repository itself.
4. Avoid path assumptions that depend on the current parent directory name.
5. Test from the real nested path before moving the folder.

## Current implementation choices

- The CLI uses `path.resolve()` on runtime input.
- The server serves dashboard assets from `src/server.js` relative paths.
- Generated markdown uses repository-relative references like `.agent-workflow/tasks/T-001/task.md`.
- The smoke test creates and exercises a sample repository under `tmp/` from the current tool location.

## After the folder is moved

Expected behavior:

- `npm run smoke` should still pass.
- `npm run dashboard -- --root <repo>` should still serve correctly.
- `npm run init -- --root <repo>` should still create workflow files under the new path.

## Future hardening

- add explicit path regression tests for spaces and Unicode
- add import and export for workflow packs
- add config migration if the project schema changes

