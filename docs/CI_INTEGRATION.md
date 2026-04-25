# CI Evidence Webhook

Agent Workflow Studio can receive CI verification evidence through:

```text
POST /api/webhook/evidence
```

The dashboard server records each accepted payload as an append-only
`ci-evidence-*.json` file under the target task's `runs/` directory. CI evidence
then appears in the task evidence timeline and adjusts trust scoring:

- latest `passed` CI evidence: `+5`
- latest `failed` CI evidence: `-10`
- latest `pending` CI evidence: no adjustment

## Payload

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
  }
}
```

Accepted status values are `passed`, `failed`, and `pending`. The webhook also
normalizes common CI terms such as `success`, `failure`, `cancelled`, `queued`,
and `in_progress`.

## Signature

Set `WORKFLOW_WEBHOOK_SECRET` on the dashboard server to require signed requests.
When the secret is set, every request must include:

```text
X-Workflow-Signature: sha256=<hex hmac>
```

The signature is the HMAC-SHA256 digest of the exact JSON request body using the
shared secret. Signature comparison uses Node's constant-time comparison. If
`WORKFLOW_WEBHOOK_SECRET` is not set, signature validation is skipped for local
development.

## Local Curl Example

```bash
BODY='{"taskId":"T-001","source":"local-ci","status":"passed","checks":["npm test: passed"],"metadata":{"sha":"dev"}}'
SECRET='replace-me'
SIGNATURE="$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')"

curl -fsS -X POST "http://localhost:4173/api/webhook/evidence" \
  -H "Content-Type: application/json" \
  -H "X-Workflow-Signature: $SIGNATURE" \
  -d "$BODY"
```

## GitHub Actions

Use `.github/workflows/evidence-webhook-example.yml` as a starting point. In
GitHub, configure these secrets or variables:

- `WORKFLOW_WEBHOOK_URL`: public URL for the dashboard endpoint, or a local URL
  when using a self-hosted runner on the same machine.
- `WORKFLOW_WEBHOOK_SECRET`: same value as the dashboard server environment
  variable.
- `WORKFLOW_TASK_ID` as an optional repository variable if the workflow cannot
  infer a `T-###` task ID from the commit message.

For GitHub-hosted runners, `localhost:4173` points at the runner itself, not your
workstation. Use a deployed dashboard URL, a tunnel, or a self-hosted runner for
real CI callbacks.
