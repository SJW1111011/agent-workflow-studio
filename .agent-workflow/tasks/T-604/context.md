# T-604 Context

## Why now

The dashboard already exposed workflow state, but it still left a key trust question unanswered: whether the recorded evidence is strong, current, and diverse enough to believe. Shipping a deterministic trust surface now makes the product's verification promises visible in the control plane instead of leaving them buried in task files and raw run records.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Added a new server-side trust-summary builder and `GET /api/trust-summary` endpoint.
- Added deterministic trust-score utilities plus overview and task-detail UI for trust score, freshness heatmap, activity log, and evidence timeline.
- Verified the implementation with `npm test` and `npm run dashboard:build`.

## Open questions

- None at implementation time.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
