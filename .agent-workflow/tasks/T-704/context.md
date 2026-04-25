# T-704 Context

## Why now

T-700 (approval), T-701 (handoff), T-702 (queue), T-703 (orchestrator) are complete. The autonomous loop is working. But there's a gap: CI verification. Agents record evidence (git diff + test collectors), but CI runs separately and its results don't flow back into the workflow system. Without CI evidence, the trust score is incomplete — it only reflects what the agent saw, not what CI verified.

This is the fifth and final task in Phase 6. After this, the complete loop is closed: agent works → CI verifies → evidence recorded → human reviews → agent continues.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Evidence records currently: run records (from workflow_done), activity records (from workflow_record_activity), handoff records (from workflow_handoff)
- Evidence records do NOT include: CI results, deploy status, external verification
- Trust score formula: 0.4 * coverage + 0.25 * signal + 0.2 * freshness + 0.15 * diversity + approval adjustment
- Trust score does NOT factor in: CI verification
- Dashboard server runs on port 4173 (default) or user-specified port
- GitHub Actions can POST to localhost if dashboard is running, or to a public URL if deployed
- HMAC-SHA256 is standard for webhook signature validation
- Node.js crypto module has `timingSafeEqual` for constant-time comparison

## Open questions

- Should webhook require authentication beyond signature? Leaning no — signature is sufficient, adding auth complicates CI setup.
- Should webhook support batch evidence (multiple tasks in one request)? Leaning no for v1 — keep it simple, one task per request.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not break any existing CLI, API, MCP, or test behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`, `npm run dashboard:build`
- Signature validation must be constant-time (use crypto.timingSafeEqual)
- Webhook must handle missing WORKFLOW_WEBHOOK_SECRET gracefully (skip validation in dev mode)
- CI evidence must be append-only — never overwrite agent evidence
