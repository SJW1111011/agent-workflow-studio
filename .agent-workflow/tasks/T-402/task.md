# T-402 - Coverage score — replace verification gate status list with a single coverage percentage

## Goal

Add a single `coveragePercent` number to the verification gate output that tells users "X% of your scoped files have evidence." Replace the current status-list model (ready/covered/partially-covered/needs-proof/scope-missing) with a coverage bar that's instantly understandable. The detailed gate status remains available for programmatic consumers but the primary display is the percentage.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/verification-gates.js (compute coveragePercent from scoped/covered file counts)
  - repo path: src/lib/checkpoint.js (display coverage percentage in checkpoint.md)
  - repo path: src/lib/overview.js (include coveragePercent in overview stats)
  - repo path: src/lib/mcp-tools.js (include coveragePercent in tool results)
  - repo path: dashboard/task-detail-helpers.js (render coverage bar/percentage)
  - repo path: dashboard/task-list-render-helpers.js (show percentage-first coverage on task cards)
  - repo path: dashboard/overview-render-helpers.js (aggregate coverage in overview)
  - repo path: dashboard/styles.css (style shared coverage UI elements)
  - repo path: test/
  - repo path: README.md
- Out of scope:
  - repo path: src/lib/evidence-utils.js (unchanged)
  - repo path: src/lib/verification-proof.js (unchanged)

## Deliverables

- `coveragePercent` field in verification gate output: `coveredScopedFiles / totalScopedFiles * 100`, rounded to integer
- `0%` when no scope defined (unconfigured), `100%` when all scoped files have evidence
- Checkpoint.md shows: `Evidence coverage: 75% (3/4 scoped files)`
- Overview includes aggregate coverage across all tasks
- Dashboard displays a percentage bar instead of a status label list
- Existing detailed gate status preserved for backward compatibility

## Risks

- Zero-scope tasks show `0%` which could be misleading — mitigate by showing "no scope defined" instead of 0%
- Percentage hides which specific files lack evidence — keep detailed file list available in checkpoint and dashboard

## Acceptance Criteria

- `checkpoint T-001` output includes `Evidence coverage: XX%`
- `workflow_overview` MCP tool returns `coveragePercent` per task
- Dashboard shows percentage bar for each task's verification status
- 0-scope tasks show "no scope defined" not "0%"
- Detailed file-level coverage still available in checkpoint.md
- `npm test` passes
