# T-704 - CI Evidence Pipeline and Webhook

## Goal

Add webhook endpoint `POST /api/webhook/evidence` so CI systems (GitHub Actions, GitLab CI, etc.) can post test results, coverage data, and deploy status as evidence. The webhook validates signatures, writes evidence records, and updates trust scores. This closes the loop — agents do work, CI verifies it, evidence appears in the dashboard, humans approve.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/server.js (add POST /api/webhook/evidence endpoint)
  - repo path: src/lib/webhook-evidence.js (new — webhook validation, evidence recording)
  - repo path: dashboard-next/src/components/EvidenceTimeline.jsx (CI evidence display)
  - repo path: dashboard-next/src/styles/app.css (CI evidence styling)
  - repo path: docs/CI_INTEGRATION.md (new — GitHub Actions setup guide)
  - repo path: .github/workflows/evidence-webhook-example.yml (new — example workflow)
  - repo path: test/webhook-evidence.test.js (new)
- Out of scope:
  - repo path: dashboard/ (legacy dashboard unchanged)

## Design

### Webhook endpoint

`POST /api/webhook/evidence`

Request body:
```json
{
  "taskId": "T-001",
  "source": "github-actions",
  "status": "passed",
  "checks": [
    "unit tests: 142 passed",
    "coverage: 87%",
    "lint: passed"
  ],
  "metadata": {
    "runId": "12345",
    "sha": "abc123",
    "branch": "main"
  },
  "signature": "sha256=..."
}
```

Response:
```json
{
  "ok": true,
  "evidenceId": "ci-evidence-1776...",
  "taskId": "T-001"
}
```

### Signature validation

Use HMAC-SHA256 with a shared secret (environment variable `WORKFLOW_WEBHOOK_SECRET`).

Signature header: `X-Workflow-Signature: sha256=<hex>`

Validation:
- Compute HMAC-SHA256 of request body with secret
- Compare with signature from header
- Reject if mismatch

If `WORKFLOW_WEBHOOK_SECRET` is not set, skip validation (dev mode).

### Evidence record

Write to `runs/ci-evidence-{timestamp}.json`:
```json
{
  "id": "ci-evidence-1776...",
  "type": "ci-evidence",
  "taskId": "T-001",
  "source": "github-actions",
  "status": "passed",
  "checks": [...],
  "metadata": {...},
  "createdAt": "..."
}
```

### Trust score update

CI evidence is stronger than agent-only evidence:
- CI-verified tasks get +5 trust score bonus
- Failed CI reduces trust score by -10

Update `src/lib/trust-summary.js` to factor in CI evidence.

### Dashboard display

EvidenceTimeline shows CI evidence with distinct styling:
- Icon: CI badge
- Color: green (passed), red (failed), yellow (pending)
- Expandable: show checks list + metadata

### GitHub Actions integration

Example workflow (`.github/workflows/evidence-webhook-example.yml`):
```yaml
name: Post Evidence to Workflow

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
      - name: Post evidence
        if: always()
        run: |
          curl -X POST http://localhost:4173/api/webhook/evidence \
            -H "Content-Type: application/json" \
            -H "X-Workflow-Signature: sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)" \
            -d "$BODY"
        env:
          SECRET: ${{ secrets.WORKFLOW_WEBHOOK_SECRET }}
          BODY: |
            {
              "taskId": "${{ github.event.head_commit.message }}",
              "source": "github-actions",
              "status": "${{ job.status }}",
              "checks": ["tests: ${{ steps.test.outcome }}"],
              "metadata": {
                "runId": "${{ github.run_id }}",
                "sha": "${{ github.sha }}",
                "branch": "${{ github.ref_name }}"
              }
            }
```

## Deliverables

- `POST /api/webhook/evidence` endpoint
- `src/lib/webhook-evidence.js` with validation + recording
- CI evidence display in EvidenceTimeline
- Trust score adjustment for CI evidence
- `docs/CI_INTEGRATION.md` setup guide
- `.github/workflows/evidence-webhook-example.yml` example
- `test/webhook-evidence.test.js`
- All existing tests pass

## Acceptance Criteria

- POST /api/webhook/evidence with valid signature → evidence recorded
- Invalid signature → 401 Unauthorized
- CI evidence appears in dashboard EvidenceTimeline
- Trust score reflects CI verification (+5 passed, -10 failed)
- GitHub Actions example workflow works
- `npm test`, `npm run smoke`, `npm run lint` pass

## Risks

- Signature validation must be constant-time to prevent timing attacks
- Webhook must handle malformed JSON gracefully
- CI evidence must not overwrite agent evidence — append-only
- Trust score adjustment must not overflow 0-100 range
