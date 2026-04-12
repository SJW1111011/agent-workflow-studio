# T-103 Context

## Why now

Current CI (`ci.yml`) only tests on one Node version with no coverage reporting and no automated publishing. As Phase 0 introduces TypeScript and Vitest, the CI must validate that compiled output works across all supported Node versions. Automated publishing eliminates the manual `npm publish` step documented in `docs/PUBLISHING.md`.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current CI: `.github/workflows/ci.yml` exists but is single-version, no coverage, no publish
- `package.json` declares `"engines": {"node": ">=18"}`
- `docs/PUBLISHING.md` documents a manual npm publish checklist
- npm publish requires `NPM_TOKEN` secret in GitHub repo settings (must be set by repo owner)
- Project already has a smoke test (`scripts/smoke-test.js`) that should also run in CI

## Open questions

- Should the publish workflow also run smoke tests before publishing?
- Codecov vs Coveralls for coverage reporting?
- Should there be a manual approval step before npm publish, or is tag-only gating sufficient?

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-102 (Vitest must be in place for coverage)
- Soft dependency on T-100 (TypeScript adds a build step CI must run)
- Cannot configure `NPM_TOKEN` — that's a manual repo-owner action
- Must not trigger publish on non-tag pushes
