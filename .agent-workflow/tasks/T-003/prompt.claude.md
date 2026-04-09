# T-003 Prompt for Claude Code

## Mission

Complete the task truthfully and leave the repository easier for the next agent to understand.

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/recipes/feature.md
- .agent-workflow/tasks/T-003/task.md
- .agent-workflow/tasks/T-003/context.md
- .agent-workflow/tasks/T-003/verification.md

## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.

## Task brief

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
  - repo path: docs/NEXT_AGENT_HANDOFF.md...

## Working context

# T-003 Context

## Why now

The project now has one proven narrow real-agent `run:execute` path for Codex plus shared preflight/readiness, additive failure categories, `stdinMode: promptFile`, and a published npm onboarding flow. The next highest-priority gap is proving that the same contract can also drive one real local Claude Code CLI path end to end on the repository itself without introducing a second executor model or broadening generated defaults too early.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The roadmap and handoff docs both prioritize proving real local adapter paths before broadening defaults.
- Built-in generated adapter scaffolds still default to `commandMode: manual`, even though the repo-local dogfooding path is allowed to opt into `exec`.
- On this machine, `cmd.exe /d /s /c claude --version` resolves successfully, while direct PowerShell invocation of the local shim resolves to `claude.ps1`, which is blocked by script-execution policy.
- `claude au...

## Verification expectations

# T-003 Verification

## Planned checks

- automated: npm test
- automated: npm run smoke
- automated: npm run validate -- --root .
- automated: npm run run:execute -- T-003 --agent claude --root .
- manual: Review the persisted run record, stdout/stderr logs, and checkpoint for T-003 to confirm the real local Claude path left durable evidence without broadening defaults.

## Proof links

### Proof 1

- Files: .agent-workflow/adapters/claude-code.json, .agent-workflow/tasks/T-003/task.md, .agent-workflow/tasks/T-003/context.md, .agent-workflow/tasks/T-003/verification.md
- Check: Scoped the repo-local Claude dogfooding adapter and task docs so one real Claude Code run can be attempted through the existing `run:execute` contract.
- Result: The task bundle now defines a narrow, local-only Claude executor pilot with explicit checks and boundaries.
- Artifact: .agent-workflow/tasks/T-003/checkpoint.md

## Blocking gaps

- The repo-local Claude path still needs one real `run:execute` attempt whose primary outcome is durable evidence, not inferred readiness from ad hoc shell probes alone.

## Required behaviors

- Stay within the requested scope.
- Call out fake implementations and unverified assumptions.
- Record runs in .agent-workflow/tasks/T-003/runs.
- Refresh checkpoint.md before handing off.
- If verification is incomplete, say so plainly.

## Claude Code notes

- Keep the repository memory aligned with any structural changes.
- Prefer concise implementation notes and explicit assumptions.
- Keep handoff quality high for future agent sessions.

## Final output

- implemented changes
- updated workflow docs
- verification status
- unresolved risks
