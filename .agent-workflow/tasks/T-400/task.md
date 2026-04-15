# T-400 - Unify evidence vocabulary — merge weak/strong/draft into two tiers with user-friendly names

## Goal

Replace the current four-tier proof vocabulary (planned / weak / draft / strong) with two tiers that new users can understand instantly: **draft** (recorded but incomplete) and **verified** (has paths + checks or artifacts). Rename internal concepts so they never surface confusing terms like "proof anchor", "weak proof", "compatibility-only", or "anchor-backed" in CLI output, MCP tool results, or dashboard labels. The internal model stays correct; only the user-facing language changes.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/evidence-utils.js (rename isStrongProof → isVerifiedEvidence, normalize field aliases)
  - repo path: src/lib/verification-proof.js (rename proof item categories)
  - repo path: src/lib/verification-gates.js (rename gate statuses: needs-proof → action-required, scope-missing → unconfigured)
  - repo path: src/lib/overview.js (rename signal statuses: strong → verified, mixed → partial)
  - repo path: src/lib/checkpoint.js (update risk messages and checkpoint text)
  - repo path: src/lib/mcp-tools.js (update tool result field names)
  - repo path: src/lib/task-documents.js (update verification.md template wording)
  - repo path: dashboard/overview-render-helpers.js (update labels)
  - repo path: dashboard/task-detail-helpers.js (update verification card labels)
  - repo path: test/ (update assertions for new names)
  - repo path: README.md (document simplified vocabulary)
- Out of scope:
  - repo path: src/lib/repository-snapshot.js (fingerprinting logic unchanged)
  - repo path: src/lib/freshness.js (staleness thresholds unchanged)
  - repo path: internal variable names that don't surface to users

## Deliverables

- Two-tier vocabulary consistently applied across CLI, MCP, dashboard, and docs:
  - **draft** = recorded evidence without paths+checks (was: weak, planned)
  - **verified** = evidence with paths AND (checks OR artifacts) (was: strong)
- Gate statuses renamed in user-facing output:
  - `needs-proof` → `action-required`
  - `partially-covered` → `incomplete`
  - `scope-missing` → `unconfigured`
  - `ready` and `covered` unchanged
- Verification signal statuses renamed:
  - `strong` → `verified`
  - `mixed` → `partial`
  - `draft` unchanged
  - `planned` merged into `draft`
  - `none` unchanged
- Dashboard labels updated
- All tests updated to match

## Risks

- Dashboard JavaScript uses string comparisons on status values — must update all references
- MCP tool results change field values — clients parsing exact strings may break
- Existing `.agent-workflow/` run records use old vocabulary in `verificationChecks[].status` — must not break reads of old records

## Acceptance Criteria

- CLI output never shows "weak", "strong", "proof anchor", or "compatibility-only"
- MCP tools return `verified` / `draft` in verification signal fields
- Dashboard labels use the new vocabulary
- Existing run records (with old field values) still load correctly
- `npm test` passes
- `npm run lint` passes
