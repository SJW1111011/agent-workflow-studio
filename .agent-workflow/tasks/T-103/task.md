# T-103 - CI matrix - GitHub Actions for Node 18/20/22, coverage, automated npm publish

## Goal

Upgrade the GitHub Actions pipeline so pull requests validate the package across the supported Node versions, CI publishes a real coverage report, and tagged releases can publish to npm without a manual `npm publish` command.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: `.github/workflows/ci.yml`
  - repo path: `.github/workflows/publish.yml`
  - repo path: `package.json`
  - repo path: `package-lock.json`
  - repo path: `vitest.config.ts`
  - repo path: `eslint.config.mjs`
  - repo path: `README.md`
  - repo path: `docs/PUBLISHING.md`
- Out of scope:
  - repo path: `src/` (no production runtime changes)
  - repo path: `dashboard/` (no frontend CI yet)
  - repo path: `test/` (test migration stays under T-102)
  - remote GitHub / Codecov / npm settings changes

## Required docs

- `.agent-workflow/project-profile.md`
- `docs/ROADMAP.md` (Phase 0 context)
- `docs/PUBLISHING.md`

## Deliverables

- `.github/workflows/ci.yml` with the Node 18/20/22 matrix, lint/format gates, coverage upload, and smoke/onboarding checks
- `.github/workflows/publish.yml` with a `v*` tag trigger, tag/version match guard, and npm publish step that uses `NPM_TOKEN`
- minimal ESLint + Prettier tooling so the CI lint/format checks are real
- README and publishing docs that explain the new coverage/publish automation

## Risks

- `NPM_TOKEN` must be configured in repo settings - this task can only scaffold the workflow, not set the secret
- Codecov repo/app setup is external to the repository - the workflow can upload coverage, but the owner may still need to activate the project for the badge to light up
- Node 18 may behave differently from Node 22 for ESM - the matrix may surface hidden compat issues (this is a feature, not a bug)
- Automated publish without a human gate is risky for a published package - mitigate with tag-only triggering plus an explicit tag/version match check

## Acceptance Criteria

- CI runs on push and PR, and the workflow defines Node 18/20/22 coverage for the supported package surface
- Coverage upload is wired and a coverage badge is present in `README.md`
- `v*` tags trigger the publish workflow, and the workflow refuses to publish if the tag does not match `package.json.version`
- CI runs lint and format checks before publishing
- Verification evidence clearly distinguishes what was validated locally vs what still requires a remote GitHub Actions run