# T-402 Context

## Why now

T-400 renames the vocabulary; T-401 hides fingerprinting. But the verification gate still returns a status enum (ready/covered/needs-proof/etc.) that requires users to learn what each status means. A coverage percentage is universally understood — "75% covered" needs zero explanation. This is the final piece that makes the evidence model invisible to new users.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `buildTaskVerificationGate()` already computes `scopeCoverage.scopedFileCount` and `scopeCoverage.coveredFileCount`
- The percentage is trivial to derive: `Math.round(covered / total * 100)` or 0 when total is 0
- Dashboard `task-detail-helpers.js` renders the verification gate as a large card — percentage bar is a visual upgrade
- `checkpoint.js` renders "Verification gate: {status}" — can prepend with coverage percentage

## Open questions

- Should coverage include draft evidence or only verified evidence? Leaning verified-only for the percentage, with draft noted separately.

## Progress notes

- 2026-04-17T01:27:00.000Z: Read the required workflow docs, traced the verification-gate data flow, and mapped the source/test files that need additive coverage-percent changes.
- 2026-04-17T01:29:00.000Z: Implemented additive `coveragePercent` plumbing through verification gates, checkpoint output, overview aggregation, dashboard coverage UI, and focused tests; targeted Vitest coverage-first checks are passing.
- 2026-04-17T01:36:00.000Z: Passed `npm run lint`, `npm test`, and `npm run smoke`; re-recorded the T-402 run with explicit scoped proof paths and refreshed the checkpoint so coverage reflects 15/15 scoped files.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-400 (vocabulary) and T-401 (strict mode)
- Detailed gate status must remain available — percentage is an addition, not a replacement
- Must pass `npm test`, `npm run lint`, `npm run smoke`
