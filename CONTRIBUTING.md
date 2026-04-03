# Contributing

Thanks for helping build Agent Workflow Studio.

This project is trying to become a local-first workflow OS and control plane for coding agents, not another generic chat shell. The best contributions protect that direction while improving usability, evidence quality, and structural stability.

## Project principles

Please keep these product truths in mind:

- tasks should compile into strong prompts
- runs should leave evidence
- evidence should refresh docs and checkpoints
- long jobs should survive context compaction and agent handoff

## Good contribution targets

High-value contributions usually improve one of these areas:

- workflow schema clarity and validation
- prompt compilation quality
- evidence capture and verification flows
- checkpoint and handoff quality
- dashboard ergonomics for workflow management
- relocatability and local-first guarantees

## What to avoid

Please avoid changes that pull the project away from its core shape:

- cloud-only assumptions
- absolute machine paths
- generic chat UI work that bypasses task structure
- large permission systems before the workflow model is stable
- automation that breaks contract-first adapter boundaries

## Before opening a pull request

1. Read `README.md` and the key docs in `docs/`.
2. Keep changes scoped and explain the workflow problem being solved.
3. Update docs when behavior, contracts, or UX change.
4. Run `npm run smoke` locally.
5. Call out any remaining risks, assumptions, or testing gaps.

## Pull request notes

A strong pull request usually includes:

- the problem statement
- the intended workflow impact
- files or contracts affected
- local validation results
- any follow-up work that should stay separate

## Design guidance

When in doubt, prefer:

- local-only behavior before remote behavior
- explicit files over hidden state
- stable contracts over clever shortcuts
- verifiable evidence over optimistic automation
- small, composable modules over crowded server logic

## Code style

- Keep the codebase dependency-light unless there is a strong reason not to.
- Do not introduce absolute paths into generated workflow state.
- Preserve schema compatibility unless you are intentionally evolving it and documenting the migration.
- Keep dashboard changes readable on both desktop and mobile.

## Questions and proposals

If you want to propose a large change, start with a small design note or issue first. That makes it easier to protect the contract-first architecture while still moving fast.
