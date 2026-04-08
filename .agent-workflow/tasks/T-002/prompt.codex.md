# T-002 Prompt for Codex

## Mission

Complete the task truthfully and leave the repository easier for the next agent to understand.

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/recipes/feature.md
- .agent-workflow/tasks/T-002/task.md
- .agent-workflow/tasks/T-002/context.md
- .agent-workflow/tasks/T-002/verification.md

## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.

## Task brief

# T-002 - Dogfood Codex run execute pilot on this repository

## Goal

Prove one narrow real local `run:execute` path on this repository itself without breaking the contract-first workflow model. The task should keep built-in defaults conservative, opt into a repo-local Codex execution profile only for dogfooding, and leave durable task-local evidence showing that prompt -> run-request -> execute -> evidence -> checkpoint works with a real local CLI. For the first pilot run, the launched Codex process should stay inspection-first: read the scoped docs, report readiness or failure truthfully, and avoid broad repo edits unless a concrete launcher issue must be patched to make the pilot honest.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: .agent-workflow/adapters/codex.json
  - repo path: .agent-workflow/tasks/T-002/
  - repo path: README.md
  - repo path: docs/RUN_EXECUTE_DESIGN.md
  - repo path: docs/NEXT_AGENT_HANDOFF.md
- Out of scope:
  - repo path: default auto-enable of execu...

## Working context

# T-002 Context

## Why now

The project already has shared executor preflight/readiness, additive failure categories, `stdinMode: promptFile`, and dashboard/CLI surfaces for advisories. The next highest-priority gap is no longer another executor abstraction; it is proving that the existing contract can drive one real local agent CLI end to end on the repository itself.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The roadmap and handoff docs both prioritize a narrow real-agent `run:execute` pilot before broader adapter defaults.
- Built-in generated adapter scaffolds still default to `commandMode: manual`, even though the Codex scaffold now includes a recommended non-interactive `codex exec ... -` template.
- On this machine, `cmd /c codex --help` resolves successfully, while direct PowerShell invocation of the local shim is blocked by script-execution policy.
- The executor already supports `stdioMode: pipe`, `stdinMode: promptFile`, run ledger persistence, stdout/stderr ...

## Verification expectations

# T-002 Verification

## Planned checks

- automated: npm test
- automated: npm run smoke
- automated: npm run validate -- --root .
- automated: npm run run:execute -- T-002 --agent codex --root .
- manual: Review the persisted run record, stdout/stderr logs, and checkpoint for T-002 to confirm the real local execution path left durable evidence without broadening defaults.

## Proof links

### Proof 1

- Files: .agent-workflow/adapters/codex.json, .agent-workflow/tasks/T-002/task.md, .agent-workflow/tasks/T-002/context.md, .agent-workflow/tasks/T-002/verification.md
- Check: Scoped the repo-local dogfooding adapter and task docs so one real Codex run can be attempted through the existing `run:execute` contract.
- Result: The task bundle now defines a narrow, local-only executor pilot with explicit checks and boundaries.
- Artifact: .agent-workflow/tasks/T-002/checkpoint.md

### Proof 2

- Files: src/lib/workspace.js, src/lib/run-executor.js, test/workspace.test.js, test/run-executor.test.js, README.md, docs/ADAPTERS.md, docs/RUN_EXECUTE_DESIGN.md, docs/NEXT_AGENT_HANDOFF.md
- Check: Updated the recommended Codex exec template after a real dogfooding run showed that the local `code...

## Required behaviors

- Stay within the requested scope.
- Call out fake implementations and unverified assumptions.
- Record runs in .agent-workflow/tasks/T-002/runs.
- Refresh checkpoint.md before handing off.
- If verification is incomplete, say so plainly.

## Codex notes

- Be explicit about the files you inspect, edit, and validate.
- Keep changes narrow and evidence-backed.
- Update workflow docs immediately after each meaningful step.

## Final output

- implemented changes
- updated workflow docs
- verification status
- unresolved risks
