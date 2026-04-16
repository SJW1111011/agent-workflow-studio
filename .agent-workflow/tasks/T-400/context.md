# T-400 Context

## Why now

The current evidence model exposes five different terms for proof quality (planned, weak, draft, strong, compatibility-only) plus three for freshness (anchor-backed, anchor-stale, compatibility-only). New users see these in checkpoint.md, verification gate cards, and CLI output without context. This is the #1 onboarding barrier — confirmed by the original project evaluation that called the evidence model "theoretical." Simplifying vocabulary is the foundation for all other Phase 3 tasks.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current proof tiers: planned (from verification.md checks section), weak/draft (recorded without full proof), strong (paths + checks/artifacts + timestamp)
- Current gate statuses: ready, covered, partially-covered, needs-proof, scope-missing
- Current signals: strong, mixed, draft, planned, none
- Current freshness: anchor-backed, compatibility-only, anchor-stale
- `verification-proof.js` uses `isStrongManualProofItem()` to classify — checks paths.length > 0 AND (checks.length > 0 OR artifacts.length > 0)
- Dashboard string comparisons are scattered across `overview-render-helpers.js` and `task-detail-helpers.js`
- MCP tools in `mcp-tools.js` return verification signal fields from `overview.js`

## Open questions

- Should internal code also rename (e.g., `isStrongManualProofItem` → `isVerifiedProofItem`)? Leaning yes for consistency, but can be a follow-up if too disruptive.

## Progress notes

### 2026-04-16T10:20:00.000Z

Reviewed the required project memory, the T-400 task bundle, and the evidence/overview/dashboard helpers. Confirmed the user-facing rename has to reach core status values, dashboard render helpers, managed verification record wording, README terminology, and backward-compatible parsing for older verification blocks.

### 2026-04-16T10:45:00.000Z

Implemented the first rename pass across `src/lib/` and the dashboard helpers so new output uses `verified`, `partial`, `draft`, `action-required`, `incomplete`, and `unconfigured`. Added compatibility handling for older labels and verification-record payloads while keeping old records readable.

### 2026-04-16T17:31:00.000Z

Finished the compatibility and verification sweep. Updated the smoke contract plus the remaining dashboard/server/task-document expectations to the new draft/verified wording, then reran the focused suite and the full `npm test`, `npm run lint`, and `npm run smoke` commands with artifacts saved under `.agent-workflow/tasks/T-400/runs/`.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not break reads of existing run records or verification.md content
- Must pass `npm test`, `npm run lint`, `npm run smoke`
- No runtime dependencies added
