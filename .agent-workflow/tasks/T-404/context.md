# T-404 Context

## Why now

Phase 3 changes the evidence vocabulary (T-400), fingerprint behavior (T-401), and display format (T-402). The project is already published to npm at v0.1.2 with real users. If upgrading breaks their existing `.agent-workflow/` data, it violates guiding principle #3 (backward compatibility). This task must land alongside T-400/T-401 to ensure the transition is invisible.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Existing run records already persist the important evidence fields; the migration risk is mostly legacy aliases and older managed markdown payloads.
- `listRuns()` now read-normalizes legacy run aliases so task detail, server responses, and MCP-overview payloads stay canonical without rewriting JSON on disk.
- `buildTaskVerificationGate()` now normalizes legacy run payloads even when callers pass raw run objects directly instead of going through `listRuns()`.
- `buildOverview()` now normalizes legacy gate, signal, and proof-coverage aliases before it counts stats or derives risk summaries.
- `schema-validator.js` still validates the raw run JSON from disk, but it now accepts legacy verification-check statuses such as `strong` / `weak` alongside the current vocabulary.
- This repository's own `.agent-workflow/` data still validates cleanly after the compatibility pass: `ok=true errors=0 warnings=0 strict=false`.

## Open questions

- No new `schemaVersion` is needed for Phase 3 compatibility because the migration stays read-only and backward-compatible.

## Progress notes

### 2026-04-16T20:05:00.000Z

Implemented the read-compatibility layer in `evidence-utils`, `task-service`, `verification-gates`, `overview`, and `schema-validator`, then added a dedicated `migration-compatibility` regression that exercises legacy run aliases, legacy manual anchor payloads, old checkpoint wording, and validate compatibility.

### 2026-04-16T20:25:00.000Z

Updated the README upgrade guidance, aligned the smoke fixture with strict-only manual anchor refresh, and reran `npm test`, `npm run lint`, `npm run validate -- --root .`, and `npm run smoke` to confirm the repo still dogfoods cleanly.

### 2026-04-16T12:40:00.000Z

Tightened the task scope to exact repo-relative paths, added explicit proof coverage for `src/lib/verification-proof.js`, and prepared a fresh prompt/checkpoint handoff so the verification gate reflects the completed migration work instead of the earlier draft scope text.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must land alongside T-400 and T-401
- Must not rewrite any existing files on disk
- Must pass `npm test`, `npm run lint`, `npm run smoke`
- This repository's own `.agent-workflow/` data must keep working as the smoke fixture
