# T-401 Context

## Why now

Content fingerprinting is the most confusing part of the evidence model. Users see "anchor-backed" vs "compatibility-only" labels without understanding why. The fingerprint computation also adds latency (SHA1 of every scoped file). Making it opt-in removes the cognitive and performance overhead for the 90% of users who don't need audit-grade proof, while preserving it for the 10% who do.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `repository-snapshot.js` computes SHA1 fingerprints via `hashFileContent()` with an LRU cache (256 entries)
- `buildScopeProofAnchors()` is called in `persistRunRecord()` to capture fingerprints at evidence recording time
- `verification-gates.js` compares current fingerprints to recorded anchors to determine freshness
- `verification-proof.js` manages the `<!-- managed:verification-manual-proof-anchors -->` block in verification.md
- `overview.js` reports `anchorBackedStrongProofCount` vs `compatibilityStrongProofCount` — this distinction disappears in normal mode
- T-400 (vocabulary rename) should land first so the labels being hidden are already renamed

## Open questions

- Should `run:execute` (adapter execution) also respect `--strict`? Leaning yes — it calls `persistRunRecord` internally.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-400 (vocabulary must be renamed first)
- Must not delete existing fingerprint data — just stop computing/displaying it in normal mode
- Must pass `npm test`, `npm run lint`, `npm run smoke`
