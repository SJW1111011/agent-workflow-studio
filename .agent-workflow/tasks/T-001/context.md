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
- What additional real-agent validation is needed before positioning the project as ready for broader external adoption?

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
