# Publishing

This project is now structured so it can be published to npm without shipping repo-local dogfooding state, tests, or temporary files.

## Release checklist

Before publishing a new version:

1. Confirm package metadata in `package.json`
   - `name`
   - `version`
   - `license`
   - `repository`
   - `homepage`
   - `bugs`
   - `files`
2. Run local verification
   - `npm test`
   - `npm run smoke`
   - `npm run validate -- --root .`
3. Inspect the publish payload
   - `npm pack --dry-run --json --cache ./.npm-cache-tmp`
4. Confirm npm registry readiness
   - `npm view agent-workflow-studio version name --json --registry https://registry.npmjs.org/`
   - `npm whoami --registry https://registry.npmjs.org/`
5. Publish
   - `npm login`
   - `npm publish --access public`

## Current pre-publish status

As of 2026-04-08:

- `npm pack --dry-run` passes with the current `package.json.files` whitelist
- `agent-workflow-studio` is not currently present in the npm registry
- this machine is not currently logged into npm for publishing (`npm whoami` returns `ENEEDAUTH`)

That means the main remaining publish step is npm authentication, not package structure.

## Expected install shapes

After publishing:

```bash
npx agent-workflow-studio init --root ../some-repo
npx agent-workflow-studio quick "Build the scanner" --task-id T-001 --priority P1 --recipe feature --agent codex --root ../some-repo
npm install -g agent-workflow-studio
agent-workflow init --root ../some-repo
```

## Notes

- The published CLI command remains `agent-workflow` because that is the `bin` entry.
- `npx` uses the package name `agent-workflow-studio`.
- Keep release steps local-first and avoid introducing publish-time absolute paths or generated machine-specific state.
