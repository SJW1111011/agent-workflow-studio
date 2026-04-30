# Launch Pack - T-809

## Adapter

- Name: Codex
- Adapter ID: codex
- Command mode: exec
- Local runner hint: `cmd.exe /d /s /c codex`
- stdin mode: promptFile

## Task

- ID: T-809
- Title: Test task

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/tasks/T-809/prompt.codex.md

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
