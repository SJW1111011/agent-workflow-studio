# T-103 Context

## Why now

Current CI only validates one Node version and still relies on a manual npm release flow. After the TypeScript/Vitest work, the project needs CI that proves the supported runtime range, preserves smoke/onboarding coverage, and automates package publishing without hiding the remaining external setup dependencies.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current CI: `.github/workflows/ci.yml` exists but is single-version, has no coverage upload, and has no publish workflow
- `package.json` declares `"engines": {"node": ">=18"}`
- `docs/PUBLISHING.md` still documents a manual npm publish checklist
- npm publish requires an `NPM_TOKEN` secret in GitHub repo settings (must be set by the repo owner)
- The project already has `npm run smoke` and `npm run verify:onboarding`, so CI can keep real package/install coverage instead of only unit tests
- Vitest already has `@vitest/coverage-v8`; adding an lcov reporter is enough to make the current coverage run upload-friendly
- ESLint and Prettier were not installed yet, so a truthful CI lint/format gate needs minimal new dev tooling in addition to the workflows

## Open questions

- Use Codecov with OIDC for coverage uploads, keep smoke/onboarding in the publish workflow, and rely on tag-only gating plus a tag/version match check for the first automated publish pass.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-102 (Vitest must be in place for coverage)
- Soft dependency on T-100 (TypeScript adds a build step CI must run)
- Cannot configure `NPM_TOKEN` or external Codecov project settings - those are manual repo-owner actions
- Must not trigger publish on non-tag pushes