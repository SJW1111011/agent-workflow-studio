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

Status: first-pass diff-aware verification gates are in place, and passed runs can now persist structured check/artifact proof. Next work should improve guardrails and capture UX instead of replacing the contract.

The next verification-freshness step should be Git-aware but still contract-first. See `docs/VERIFICATION_FRESHNESS_DESIGN.md`.

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

