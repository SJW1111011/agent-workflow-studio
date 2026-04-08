# T-001 Prompt for Codex

## Mission

Complete the task truthfully and leave the repository easier for the next agent to understand.

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/recipes/review.md
- .agent-workflow/tasks/T-001/task.md
- .agent-workflow/tasks/T-001/context.md
- .agent-workflow/tasks/T-001/verification.md

## Recipe

- Recipe ID: review
- Recipe summary: Review changes for correctness, regressions, and missing tests.

## Task brief

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

- grounded memory docs for this reposi...

## Working context

# T-001 Context

## Why now

The repository just gained `quick` and `memory:bootstrap`; before broader distribution or npm publishing, the project should use that onboarding path on itself and capture what still feels rough.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: review
- Recommended for: PR review, post-implementation check, handoff review
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- This repository did not have a checked-in `.agent-workflow/` state before the current dogfooding pass.
- `memory:bootstrap` now writes a reusable prompt to `.agent-workflow/handoffs/memory-bootstrap.md`.
- `quick` now refreshes project profile, creates a task bundle, compiles a prompt, prepares run-request/launch pack, and refreshes the checkpoint in one local flow.
- The repo stays zero-dependency and local-first; durable workflow state is expected to remain repo-relative and Git-friendly.

## Open questions

- Which generated workflow files should remain checked in as dogfooding expands?
- Does the onboarding prompt need agent-specific variants, or is a shared bootstrap prompt enough for now?
- What additional real-...

## Verification expectations

# T-001 Verification

## Planned checks

- automated: npm test
- automated: npm run smoke
- manual: Review the generated `.agent-workflow/` memory and task bundle for grounded, repo-specific content.

## Proof links

### Proof 1

- Files: .agent-workflow/memory/product.md, .agent-workflow/memory/architecture.md, .agent-workflow/memory/domain-rules.md, .agent-workflow/memory/runbook.md, .agent-workflow/tasks/T-001/task.md, .agent-workflow/tasks/T-001/context.md
- Check: Reviewed the generated onboarding artifacts, grounded the memory docs with repo-specific facts, and ran the local validation commands.
- Result: The repository can now use its own onboarding path with concrete memory/task docs, and the local validation suite still passes after the generated state is grounded.
- Artifact: .agent-workflow/tasks/T-001/checkpoint.md

## Blocking gaps

- None right now; refresh proof and checkpoint again if the grounded memory or task docs change.

## Evidence

<!-- agent-workflow:managed:verification-manual-proof-anchors:start -->
### Manual proof anchors

```json
{
  "version": 1,
  "manualProofAnchors": [
    {
      "proofSignature": "sha1:1db5fe5d489a0f98130cbbf1c10d3ac6928784c9",
  ...

## Required behaviors

- Stay within the requested scope.
- Call out fake implementations and unverified assumptions.
- Record runs in .agent-workflow/tasks/T-001/runs.
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
