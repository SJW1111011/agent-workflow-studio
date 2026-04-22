# T-604 - Dashboard Trust Surface

## Goal

Transform the dashboard from a data viewer into a trust surface that answers "can I trust what the agent did?" Add a deterministic trust score per task, an evidence freshness heatmap across all tasks, and an evidence timeline in task detail.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: dashboard-next/src/components/Overview.jsx (trust score card, freshness heatmap)
  - repo path: dashboard-next/src/components/TrustScore.jsx (new — trust score display component)
  - repo path: dashboard-next/src/components/EvidenceTimeline.jsx (new — chronological evidence events)
  - repo path: dashboard-next/src/components/TaskDetail.jsx (evidence timeline, activity log)
  - repo path: dashboard-next/src/utils/trustScore.js (new — pure trust score calculation)
  - repo path: src/server.js (new API endpoint: GET /api/trust-summary)
  - repo path: test/trust-score.test.js (new tests)
- Out of scope:
  - repo path: src/lib/mcp-tools.js (no MCP changes)
  - repo path: src/lib/evidence-collectors.js (T-600 already done)

## Design

### Trust Score (0-100, deterministic)

Pure function of evidence data, no ML or heuristics:
- Evidence coverage weight: 40% (coveragePercent from verification gate)
- Verification signal weight: 25% (verified=100, partial=50, draft=25, none=0)
- Evidence freshness weight: 20% (current=100, recorded=60, stale=20)
- Collector diversity weight: 15% (more independent collectors = higher trust)

Formula: `trustScore = 0.4 * coverage + 0.25 * signal + 0.2 * freshness + 0.15 * diversity`

### Dashboard Components

- TrustScore: circular progress indicator with score number, color-coded (green >= 80, yellow >= 50, red < 50)
- Overview: aggregate trust score card alongside existing task count cards
- EvidenceTimeline: vertical timeline of all evidence events (runs, activity records, verification changes) for a task
- Freshness heatmap: grid of tasks × time, color = freshness status

### API

`GET /api/trust-summary` returns:
```json
{
  "aggregateTrustScore": 72,
  "taskScores": [{ "taskId": "T-001", "trustScore": 85, "coverage": 100, "signal": "verified", "freshness": "current" }],
  "freshnessDistribution": { "current": 15, "recorded": 8, "stale": 2 }
}
```

## Deliverables

- `dashboard-next/src/utils/trustScore.js` with pure calculation function
- `dashboard-next/src/components/TrustScore.jsx` display component
- `dashboard-next/src/components/EvidenceTimeline.jsx` timeline component
- Updated `Overview.jsx` with trust score card and freshness heatmap
- Updated `TaskDetail.jsx` with evidence timeline
- Updated `src/server.js` with `/api/trust-summary` endpoint
- `test/trust-score.test.js` with tests for score calculation
- Works in both light and dark themes
- `dashboard:build` succeeds

## Acceptance Criteria

- Trust score visible in Overview and TaskDetail
- Score is deterministic and testable (pure function)
- Freshness heatmap renders for 20+ tasks
- Evidence timeline shows all evidence events chronologically
- Works in both light and dark themes
- `npm run dashboard:build` succeeds
- `npm test` passes

## Risks

- Trust score formula may need tuning after real-world usage — keep it simple and adjustable
- Heatmap may be hard to read with many tasks — consider pagination or filtering
