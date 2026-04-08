# Launch Pack - T-001

## Adapter

- Name: Codex
- Adapter ID: codex
- Command mode: manual
- Local runner hint: `codex`
- stdin mode: promptFile

## Task

- ID: T-001
- Title: Dogfood onboarding path on agent-workflow-studio itself

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/tasks/T-001/prompt.codex.md

## Suggested operator flow

1. Start the agent in the target repository root.
2. Give it the prompt file above as the primary instruction bundle.
3. Keep the run within task scope and update workflow docs during execution.
4. After the run, record evidence and refresh checkpoint.md.

## Expected outputs

- code changes or confirmed no-op
- updated workflow docs
- clear verification status
- explicit unresolved risks
