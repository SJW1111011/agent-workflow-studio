# T-101 Prompt for Codex

## Mission

Complete the task truthfully and leave the repository easier for the next agent to understand.

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/recipes/feature.md
- .agent-workflow/tasks/T-101/task.md
- .agent-workflow/tasks/T-101/context.md
- .agent-workflow/tasks/T-101/verification.md

## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.

## Task brief

# T-101 - ESM dual-package — exports field, CJS backward-compat preserved

## Goal

State the user outcome in one paragraph.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path:
- Out of scope:
  - repo path:

## Required docs

- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md

## Deliverables

- code or config changes
- updated docs
- verification evidence

## Risks

- contract mismatches
- fake implementations
- unverified assumptions

## Working context

# T-101 Context

## Why now

Describe why this task matters.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- 

## Open questions

- 

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->

## Verification expectations

# T-101 Verification

## Planned checks

- automated:
- manual:

## Proof links

### Proof 1

- Files:
- Check:
- Result:
- Artifact:

## Blocking gaps

-

## Required behaviors

- Stay within the requested scope.
- Call out fake implementations and unverified assumptions.
- Record runs in .agent-workflow/tasks/T-101/runs.
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
