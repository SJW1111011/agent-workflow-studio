# T-404 Prompt for Codex

## Mission

Complete the task truthfully and leave the repository easier for the next agent to understand.

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/recipes/feature.md
- .agent-workflow/tasks/T-404/task.md
- .agent-workflow/tasks/T-404/context.md
- .agent-workflow/tasks/T-404/verification.md

## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.

## Task brief

# T-404 - Transparent data migration — existing .agent-workflow data works with new evidence model without manual changes

## Goal

Ensure existing `.agent-workflow/` data created before Phase 3 works transparently with the new evidence model. Old run records with "strong"/"weak" labels, old verification.md files with managed anchor blocks, and old checkpoint.md files with "needs-proof"/"partially-covered" text must all load, display, and process correctly without user intervention. No manual migration step required.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/evidence-utils.js
  - repo path: src/lib/task-service.js
  - repo path: src/lib/verification-gates.js
  - repo path: src/lib/overview.js
  - repo path: src/lib/verification-proof.js
  - repo path: src/lib/schema-validator.js
  - repo path: scripts/smoke-test.js
  - repo path: test/migration-compatibility.test.js
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/ (UI handles whatever the API returns ...

## Working context

# T-404 Context

## Why now

Phase 3 changes the evidence vocabulary (T-400), fingerprint behavior (T-401), and display format (T-402). The project is already published to npm at v0.1.2 with real users. If upgrading breaks their existing `.agent-workflow/` data, it violates guiding principle #3 (backward compatibility). This task must land alongside T-400/T-401 to ensure the transition is invisible.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Existing run records already persist the important evidence fields; the migration risk is mostly legacy aliases and older managed markdown payloads.
- `listRuns()` now read-normalizes legacy run aliases so task detail, server responses, and MCP-overview payloads stay canonical without rewriting JSON on disk.
- `buildTaskVerificationGate()` now normalizes legacy run payloads even when callers pass raw run objects directly instead of going through `listRuns()`.
- `buildOverview()` now normalizes legacy gate, signal, and proof-coverage a...

## Verification expectations

# T-404 Verification

## Planned checks

- automated: `npm test`
- automated: `npm run lint`
- automated: `npm run validate -- --root .`
- automated: `npm run smoke`
- manual: inspect legacy run alias handling, legacy manual anchor preservation, and regenerated checkpoint wording

## Proof links

### Proof 1

- Files: `src/lib/evidence-utils.js`, `src/lib/task-service.js`, `src/lib/verification-gates.js`, `src/lib/overview.js`, `src/lib/verification-proof.js`, `src/lib/schema-validator.js`, `test/migration-compatibility.test.js`
- Check: legacy run aliases, legacy manual anchor payloads, legacy checkpoint wording, strict-off manual anchor preservation, and validate compatibility all pass through the new read-normalization path without rewriting historical files
- Result: passed
- Artifact: `.agent-workflow/tasks/T-404/runs/npm-test-migration.log`

### Proof 2

- Files: `README.md`
- Check: added an "Upgrading from pre-Phase-3" section that explains the no-manual-migration path and the strict-verification note for managed anchor refresh
- Result: passed
- Artifact:

### Proof 3

- Files: `.agent-workflow/project.json`, `.agent-workflow/tasks/`
- Check: `npm run validate -- --root .`...

## Required behaviors

- Stay within the requested scope.
- Call out fake implementations and unverified assumptions.
- Record runs in .agent-workflow/tasks/T-404/runs.
- Refresh checkpoint.md before handing off.
- If verification is incomplete, say so plainly.

## Codex notes

- Be explicit about the files you inspect, edit, and validate.
- Keep changes narrow and evidence-backed.
- Update workflow docs immediately after each meaningful step.

## Final output

- implemented changes
- updated workflow docs
- verification status
- unresolved risks
