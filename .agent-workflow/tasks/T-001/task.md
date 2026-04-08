# T-001 - Dogfood onboarding path on agent-workflow-studio itself

## Goal

Use the repository on itself: bootstrap memory, create a real task bundle, replace scaffold placeholders with grounded notes, and leave clear verification evidence for the onboarding path.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: review
- Recipe summary: Review changes for correctness, regressions, and missing tests.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: .agent-workflow/memory/product.md
  - repo path: .agent-workflow/memory/architecture.md
  - repo path: .agent-workflow/memory/domain-rules.md
  - repo path: .agent-workflow/memory/runbook.md
  - repo path: .agent-workflow/tasks/T-001/task.md
  - repo path: .agent-workflow/tasks/T-001/context.md
- Out of scope:
  - repo path: cloud sync or auth systems
  - repo path: broad adapter/plugin extensibility work
  - repo path: TypeScript migration

## Required docs

- README.md
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- docs/NEXT_AGENT_HANDOFF.md

## Deliverables

- grounded memory docs for this repository
- a real dogfooding task bundle under `.agent-workflow/tasks/T-001/`
- verification evidence showing the onboarding path still passes local checks

## Risks

- repo-specific memory could still overclaim facts not directly supported by docs/code
- onboarding may still feel too manual even after `memory:bootstrap` and `quick`
- generated workflow state may need policy decisions about what stays committed long-term
