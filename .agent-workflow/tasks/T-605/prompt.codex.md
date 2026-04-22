# T-605 Prompt for Codex

> Deprecated: `prompt:compile` will be removed in 0.3.0. Prefer MCP resource `workflow://tasks/{taskId}` or prompt `workflow-resume` when available.

## Mission

Complete the task truthfully and leave the repository easier for the next agent to understand.

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/recipes/feature.md
- .agent-workflow/tasks/T-605/task.md
- .agent-workflow/tasks/T-605/context.md
- .agent-workflow/tasks/T-605/verification.md

## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.

## Task brief

# T-605 - Deprecate prompt:compile and skills:generate

## Goal

Mark `prompt:compile` and `skills:generate` as deprecated, print warnings to stderr, and update documentation to point users to MCP resources and prompts instead. Commands still work — deprecation only, no removal until 0.3.0.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/cli.js (add deprecation warnings to prompt:compile and skills:generate)
  - repo path: src/lib/prompt-compiler.js (add deprecation notice at top of output)
  - repo path: AGENT_GUIDE.md (update MCP path to reference resources/prompts)
  - repo path: README.md (remove prompt:compile from primary paths, add note about deprecation)
  - repo path: docs/ROADMAP.md (update Phase 5 progress)
- Out of scope:
  - repo path: src/lib/mcp-tools.js (no MCP changes)
  - repo path: dashboard-next/ (no dashboard changes)

## Design

- `prompt:compile` prints to stderr: "Deprecated: use MCP resource workflow://tasks/{taskId} or prompt workflow-resume instead. pr...

## Working context

# T-605 Context

## Why now

Phase 5 already introduced MCP resources and prompts as the preferred handoff path, so leaving `prompt:compile` and `skills:generate` positioned as first-class guidance keeps steering users toward legacy flows. Deprecating them now preserves backward compatibility for existing scripts while shifting new usage toward MCP before the planned 0.3.0 removal.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The implementation scope is limited to deprecation warnings in `src/cli.js`, a notice in `src/lib/prompt-compiler.js`, and doc updates in `AGENT_GUIDE.md`, `README.md`, and `docs/ROADMAP.md`.
- The warning text must go to stderr only so CLI output remains safe for stdio-based MCP transport.
- Both commands stay functional in 0.2.x; this task is deprecation-only and must not remove the legacy paths yet.

## Open questions

- Secondary docs outside the declared scope still mention the legacy commands and may need a follow-up cleanup task.

## Constraints...

## Verification expectations

# T-605 Verification

## Draft checks

- automated:
  - `npm test`
  - `npm run smoke`
- manual:
  - Capture stdout/stderr from `node src/cli.js prompt:compile T-605 --root .` and verify the deprecation warning is stderr-only while the command still writes the prompt file.
  - Capture stdout/stderr from `node src/cli.js skills:generate --root <temp-workspace>` and verify the deprecation warning is stderr-only while the command still generates guide files.

## Verification records

### Record 1

- Files:
- Check:
- Result:
- Artifact:

## Blocking gaps

- Verification not yet run.

## Required behaviors

- Stay within the requested scope.
- Call out fake implementations and unverified assumptions.
- Record runs in .agent-workflow/tasks/T-605/runs.
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
