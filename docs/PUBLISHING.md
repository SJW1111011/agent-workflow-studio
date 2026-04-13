# Publishing

This project is now published on npm as `agent-workflow-studio@0.1.2`, and the release flow is documented here so future publishes stay local-first, reproducible, and clean.

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
   - update `CHANGELOG.md` with the new release entry before publish
2. Confirm publish guardrails
   - root `.npmignore` still mirrors non-runtime repo directories such as `.agent-workflow/`, `test/`, `scripts/`, and `tmp/`
3. Run local verification
   - `npm run lint`
   - `npm run format:check`
   - `npm run build`
   - `npm test`
   - `npm run test:coverage`
   - `npm run smoke`
   - `npm run validate -- --root .`
   - `npm run verify:onboarding`
4. Inspect the publish payload
   - `npm pack --dry-run --json --cache ./.npm-cache-tmp`
   - confirm `dist/` is present alongside `src/` because `src/lib/fs-utils.js` bridges to compiled output
5. Confirm npm registry readiness
   - `npm view agent-workflow-studio version name --json --registry https://registry.npmjs.org/`
   - `npm whoami --registry https://registry.npmjs.org/`
6. Push the release tag that should publish
   - confirm the repository secret `NPM_TOKEN` is configured in GitHub Actions settings
   - confirm the repository is connected to Codecov so the coverage badge can refresh from CI uploads
   - `git tag v0.2.0`
   - `git push origin v0.2.0`
7. Verify the published install surface
   - `npm view agent-workflow-studio version name --json --registry https://registry.npmjs.org/`
   - `npm install -g agent-workflow-studio`
   - `agent-workflow --help`
   - `agent-workflow dashboard --root ../some-repo --port 4173`
   - `npm install agent-workflow-studio`
   - `npx agent-workflow --help`
   - `npx agent-workflow dashboard --root ../some-repo --port 4173`

## Current release status

As of 2026-04-10:

- `agent-workflow-studio@0.1.2` is live in the npm registry
- `npm whoami --registry https://registry.npmjs.org/` returns `sjw1111011` on this machine
- `npm view agent-workflow-studio version name --json --registry https://registry.npmjs.org/` confirms the published `0.1.2` package
- CI is now intended to run a Node 18/20/22 matrix plus a Node 22 coverage upload on `.github/workflows/ci.yml`
- tagged releases are now intended to publish through `.github/workflows/publish.yml`, which expects the repo-level `NPM_TOKEN` secret
- the release surface is now guarded two ways: `package.json.files` remains the primary whitelist, and root `.npmignore` mirrors non-runtime repo state as an explicit packaging backstop
- a clean temp install of `agent-workflow-studio@0.1.2` now verifies `npx agent-workflow --help`, `init`, `scan`, `memory:bootstrap`, `quick`, `validate`, and `npx agent-workflow dashboard --root ... --port 4175`
- local CI now also exercises the packed-tarball install path plus dashboard `Quick Create`, so publish regressions are less likely to hide behind repo-root smoke coverage
- future publishes still require npm 2FA-compatible auth, such as an OTP or a granular access token with bypass 2FA enabled

The main remaining release work is now polish around the published install experience, not package structure.

See `docs/GETTING_STARTED.md` for the short npm-first onboarding path that was derived from this external validation pass.

## Expected install shapes

Current install and verification commands:

```bash
npm install -g agent-workflow-studio
agent-workflow --help
agent-workflow init --root ../some-repo
agent-workflow dashboard --root ../some-repo --port 4173
npm install agent-workflow-studio
npx agent-workflow --help
npx agent-workflow init --root ../some-repo
npx agent-workflow dashboard --root ../some-repo --port 4173
```

## Notes

- The published CLI command remains `agent-workflow` because that is the `bin` entry.
- The release automation is tag-driven: pushing `v*` should run `.github/workflows/publish.yml`, and the workflow also checks that the tag matches `package.json.version` before `npm publish`.
- `package.json.bin` now points at `src/cli.js` directly, which keeps `npm publish` from auto-cleaning that field during release.
- `prepublishOnly` now runs `npm run build`, and the publish payload must keep both `src/` and `dist/` because the first TypeScript bridge resolves compiled output from `dist/lib/fs-utils.js`.
- `package.json.files` remains the primary publish whitelist; `.npmignore` is kept in sync as a repo-level guardrail for directories that should never ship.
- because the package name and the executable name differ, the reliable `npx` form is `npx agent-workflow` after the package has been installed locally
- Keep release steps local-first and avoid introducing publish-time absolute paths or generated machine-specific state.
