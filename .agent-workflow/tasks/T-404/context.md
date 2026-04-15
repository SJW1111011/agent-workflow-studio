# T-404 Context

## Why now

Phase 3 changes the evidence vocabulary (T-400), fingerprint behavior (T-401), and display format (T-402). The project is already published to npm at v0.1.2 with real users. If upgrading breaks their existing `.agent-workflow/` data, it violates guiding principle #3 (backward compatibility). This task must land alongside T-400/T-401 to ensure the transition is invisible.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Existing run records use `verificationChecks[].status` with values "passed", "failed", "recorded", "info" — these don't change
- The "strong"/"weak" distinction lives in computed fields (`strongProofCount`, `draftProofCount`) in overview, not in persisted data — renaming is safe
- Gate statuses ("needs-proof", etc.) are computed on the fly by `buildTaskVerificationGate` — not stored — renaming is safe
- The only persisted vocabulary is in verification.md text (human-readable) and managed anchor blocks (machine-readable JSON)
- `schema-validator.js` validates run records, task.json, and adapter configs — must accept both old and new field patterns
- This project's own `.agent-workflow/` directory has 16 tasks with 30+ runs — it IS the migration test fixture

## Open questions

- Should we add a `schemaVersion: 2` to project.json to mark Phase 3 migration? Leaning no — it's backward compatible, no version bump needed.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must land alongside T-400 and T-401
- Must not rewrite any existing files on disk
- Must pass `npm test`, `npm run lint`, `npm run smoke`
- This project's own `.agent-workflow/` data must work as the smoke test
