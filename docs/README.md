# Documentation Map

Use this directory in layers instead of reading every file front to back.

## Start here

- [`GETTING_STARTED.md`](GETTING_STARTED.md) - the shortest verified npm-first onboarding path
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - the system-level view of the workflow scaffold, dashboard, and local control plane
- [`ROADMAP.md`](ROADMAP.md) - where the project is likely to go next

## Core design docs

- [`VERIFICATION_FRESHNESS_DESIGN.md`](VERIFICATION_FRESHNESS_DESIGN.md) - verification gates, proof anchors, repository snapshots, and freshness behavior
- [`RUN_EXECUTE_DESIGN.md`](RUN_EXECUTE_DESIGN.md) - shared execution planning, preflight/readiness, and local adapter execution boundaries
- [`RECIPES_AND_SCHEMA.md`](RECIPES_AND_SCHEMA.md) - recipe metadata, validation rules, and task/schema relationships
- [`RELOCATABLE_DESIGN.md`](RELOCATABLE_DESIGN.md) - why generated workflow state stays movable across directories and machines

## Operator guides

- [`ADAPTERS.md`](ADAPTERS.md) - built-in adapters, custom adapter scaffolding, and adapter contract notes
- [`PUBLISHING.md`](PUBLISHING.md) - release checklist, npm publishing notes, and post-publish verification

## Product and backlog docs

- [`PRD.md`](PRD.md) - the product framing and intended user problems
- [`ISSUE_BACKLOG.md`](ISSUE_BACKLOG.md) - open backlog items and rough implementation candidates
- [`NEXT_AGENT_HANDOFF.md`](NEXT_AGENT_HANDOFF.md) - the latest compact handoff for the next coding agent

## Suggested reading paths

- New user: `GETTING_STARTED.md` -> `ARCHITECTURE.md`
- Evaluating the verification model: `VERIFICATION_FRESHNESS_DESIGN.md` -> `RUN_EXECUTE_DESIGN.md`
- Extending adapters: `ADAPTERS.md` -> `RUN_EXECUTE_DESIGN.md`
- Contributing a change: root `README.md` -> `ARCHITECTURE.md` -> `NEXT_AGENT_HANDOFF.md`
