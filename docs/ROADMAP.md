# Roadmap

## Phase 0 - Foundation

- workflow storage layout
- scanner
- task package
- prompt compiler
- run ledger
- checkpoint generator
- dashboard shell and local mutation flows

Status: in progress in this repository.

Onboarding now also has first-pass shortcuts:

- `quick` for the common task bootstrap flow
- `memory:bootstrap` for generating a local-only memory bootstrap prompt instead of requiring embedded AI calls

## Near-term priorities

- P0: prove one real local `run:execute` path on top of the current run-request contract instead of broadening executor surface area blindly
- P1: dogfood that real execution path in this repository so prompt -> run -> evidence -> checkpoint stays grounded in actual use
- P1: decide which checked-in `.agent-workflow/` artifacts should remain as durable examples versus temporary dogfooding state
- P2: revisit adapter extensibility only after the executor/evidence path is proven stable

## Phase 1 - Stronger prompt compiler

- task-type presets for audit, feature, bugfix, and review
- agent-specific prompt modifiers
- mandatory doc bundle generation
- risk-aware prompt sections
- real adapter executors on top of the current run-request contracts

## Phase 2 - Verification layer

- diff-aware command templates
- explicit unverified state tracking
- verification artifact attachment
- failure triage view

Status: first-pass diff-aware verification gates are in place, Git-aware repository snapshots now back current-diff detection, passed runs can persist structured check/artifact proof plus optional `scopeProofAnchors`, and manual `verification.md` proof can now also refresh managed proof anchors.

Next verification work should stay contract-first:

- keep anchor-backed proof additive and backward-compatible for legacy/manual evidence
- keep freshness decisions explainable from repo-relative artifacts instead of broadening hidden heuristics
- extend real-world dogfooding before widening the proof model again

The next verification-freshness step should be content-aware but still contract-first. See `docs/VERIFICATION_FRESHNESS_DESIGN.md`.

## Phase 3 - Multi-agent orchestration

- agent role assignment
- explorer and reviewer lanes
- handoff packs
- resume bundles

## Phase 4 - External integrations

- GitHub issues and PR links
- branch and diff views
- CI ingestion
- release readiness board

## Phase 5 - Kinds of polish that matter

- tighter UX
- better keyboard flows
- richer search
- stale memory warnings
- richer audit exports

