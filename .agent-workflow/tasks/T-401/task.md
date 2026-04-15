# T-401 - Fingerprint opt-in — make proof anchor fingerprinting --strict only, default to timestamp-based

## Goal

Make content fingerprinting (SHA1 hash comparison) opt-in via a `--strict` flag instead of the default behavior. In normal mode, evidence freshness is determined by timestamps only — simpler, faster, and sufficient for most users. `--strict` mode activates fingerprint-based verification for compliance/audit scenarios where timestamp-only proof is insufficient. Users should never see "anchor-backed", "anchor-stale", or "compatibility-only" labels unless they explicitly opted into strict mode.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/verification-gates.js (skip fingerprinting unless strict flag is set)
  - repo path: src/lib/repository-snapshot.js (make `buildScopeProofAnchors` fingerprinting conditional)
  - repo path: src/lib/verification-proof.js (managed anchor block only created in strict mode)
  - repo path: src/lib/evidence-utils.js (proof anchor normalization skips fingerprint when not strict)
  - repo path: src/lib/checkpoint.js (pass strict flag through)
  - repo path: src/lib/task-service.js (pass strict flag from run recording)
  - repo path: src/cli.js (add `--strict` flag to `checkpoint`, `run:add`, `done`, `validate`)
  - repo path: src/lib/mcp-tools.js (add `strict` boolean to relevant tool schemas)
  - repo path: .agent-workflow/project.json (add `strictVerification: false` as project-level default)
  - repo path: test/ (update tests)
  - repo path: README.md
- Out of scope:
  - repo path: dashboard/ (UI strict mode toggle deferred to Phase 4)
  - repo path: deleting fingerprint code (keep it, just gate it behind --strict)

## Deliverables

- Normal mode (default): no fingerprint computation, no managed anchor blocks, evidence freshness by timestamp comparison only
- Strict mode (`--strict` flag or `project.json` setting): full fingerprint computation, managed anchor blocks, anchor-backed/stale distinction
- `project.json` gains `strictVerification` boolean (default false)
- CLI flags: `--strict` on checkpoint, run:add, done, validate
- MCP tools: `strict` boolean parameter on workflow_checkpoint, workflow_run_add, workflow_done, workflow_validate
- Tests covering both modes

## Risks

- Existing projects that rely on fingerprint-backed freshness will silently downgrade to timestamp-only — mitigate with migration task T-404 that warns and offers `--strict` opt-in
- `buildScopeProofAnchors` is called in `persistRunRecord` — must check strict flag at that call site
- The managed anchor block in verification.md must not be deleted when switching modes — just stop updating it

## Acceptance Criteria

- Default `checkpoint` output never mentions "anchor-backed" or "compatibility-only"
- `checkpoint --strict` output shows fingerprint-backed freshness labels
- `project.json` `strictVerification: true` enables strict globally without per-command flags
- No fingerprint computation when strict is off (performance improvement)
- Existing managed anchor blocks in verification.md preserved (not deleted) when strict is off
- `npm test` passes
- `npm run lint` passes
