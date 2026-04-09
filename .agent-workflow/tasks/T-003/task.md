# T-003 - Dogfood Claude Code run execute pilot on this repository

## Goal

Prove one narrow real local `run:execute` path for Claude Code on this repository without breaking the contract-first workflow model. The task should keep built-in defaults conservative, opt into a repo-local Claude Code execution profile only for dogfooding, and leave durable task-local evidence showing that prompt -> run-request -> execute -> evidence -> checkpoint works with a real local CLI. For the first pilot run, the launched Claude process should stay inspection-first: read the scoped docs, report readiness or failure truthfully, and avoid broad repo edits unless a concrete launcher issue must be patched to make the pilot honest.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: .agent-workflow/adapters/claude-code.json
  - repo path: .agent-workflow/tasks/T-003/
  - repo path: README.md
  - repo path: docs/ADAPTERS.md
  - repo path: docs/RUN_EXECUTE_DESIGN.md
  - repo path: docs/NEXT_AGENT_HANDOFF.md
- Out of scope:
  - repo path: default auto-enable of executor mode for generated adapters
  - repo path: browser terminal emulation or dashboard-owned process state
  - repo path: cloud execution, sync, or auth redesign
  - repo path: broad adapter/plugin extensibility work

## Required docs

- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- docs/ADAPTERS.md
- docs/RUN_EXECUTE_DESIGN.md
- docs/NEXT_AGENT_HANDOFF.md

## Deliverables

- repo-local Claude Code dogfooding adapter config that can attempt one real local run
- task-local run evidence and refreshed checkpoint for T-003
- updated docs or handoff notes describing what worked, what failed, and what remains narrow/opt-in
- a first real launched Claude Code run whose primary output is durable evidence, not unrelated repository edits

## Risks

- Windows wrapper behavior may differ between shell discovery and Node child-process spawning
- Claude Code print mode may need a narrower confirmed argv shape than the current manual scaffold implies
- success on this machine must not be mistaken for a safe default on every machine
