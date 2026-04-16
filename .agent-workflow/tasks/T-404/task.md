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
  - repo path: dashboard/ (UI handles whatever the API returns — no special migration logic needed)
  - repo path: rewriting existing files on disk (read compatibility, not write migration)

## Deliverables

- Run records with `verificationChecks[].status: "passed"/"failed"` continue to load correctly
- Old verification.md managed anchor blocks preserved (not deleted) when strict mode is off
- Old checkpoint.md text with "needs-proof" still renders (regenerated checkpoint will use new vocabulary)
- `validate` command accepts both old and new vocabulary without errors
- README includes "Upgrading from pre-Phase-3" section explaining what changed
- Tests using fixture data with old vocabulary prove backward compatibility

## Risks

- Edge case: a run record with `strongProofCount` field name — must still parse correctly even though we renamed the concept
- Old managed anchor blocks in verification.md must survive `checkpoint` regeneration (which rewrites checkpoint.md but not verification.md)

## Acceptance Criteria

- `task:list` on a repo with pre-Phase-3 data works without errors
- `checkpoint T-001` on a pre-Phase-3 task regenerates checkpoint with new vocabulary
- `validate` on pre-Phase-3 data returns ok=true
- Old run records are readable and their status values map to the new vocabulary in CLI/MCP output
- No file-rewriting migration step required
- `npm test` passes with migration fixture tests
