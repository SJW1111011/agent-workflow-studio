# T-103 - CI matrix — GitHub Actions for Node 18/20/22, coverage, automated npm publish

## Goal

Upgrade the GitHub Actions CI pipeline to test across Node 18/20/22, report coverage to a badge-compatible service, and automate npm publishing on tagged releases. After this task, every PR gets a multi-version green check, coverage is visible, and `npm publish` is hands-free on version tags.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: .github/workflows/ci.yml (rewrite)
  - repo path: .github/workflows/publish.yml (new — npm publish on tag)
  - repo path: package.json (if scripts need adjustment for CI)
- Out of scope:
  - repo path: src/ (no production code changes)
  - repo path: dashboard/ (no frontend CI yet)
  - repo path: test/ (test migration is T-102's scope)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 0 context)
- docs/PUBLISHING.md (existing publish checklist)

## Deliverables

- `.github/workflows/ci.yml`: matrix strategy [Node 18, 20, 22], runs `npm test`, uploads coverage
- `.github/workflows/publish.yml`: triggers on `v*` tags, runs tests, publishes to npm via `NPM_TOKEN` secret
- Coverage badge in README (Codecov or Coveralls)
- ESLint + Prettier check in CI (after T-100 adds them)

## Risks

- `NPM_TOKEN` secret must be configured in repo settings — task can only scaffold the workflow, not set the secret
- Node 18 may have different behavior than 22 for ESM — matrix may surface hidden compat issues (this is a feature, not a bug)
- Automated publish without human gate is risky for a published package — mitigate with tag-only trigger

## Acceptance Criteria

- CI runs on push and PR, tests pass on Node 18, 20, 22
- Coverage uploaded and badge visible in README
- `git tag v0.2.0 && git push --tags` triggers publish workflow (dry-run verified)
- Lint step fails CI on violations
- Publish workflow requires tag match `v*` (no accidental publishes)
