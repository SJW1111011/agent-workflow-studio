# Domain Rules

## Rules that must stay true

- Tasks should compile into strong prompts.
- Runs should leave evidence.
- Evidence should refresh docs and checkpoints.
- Long jobs should survive context compaction and agent handoff.
- Automation is a product goal, but it must not outrun structure stability or truthful verification.

## Contract assumptions

- `.agent-workflow/` is the durable workflow state and should remain portable across machines.
- Adapter configs are the vendor boundary; core workflow logic should not hard-code vendor-specific orchestration paths.
- Manual proof and executor proof are both valid, but both must stay explicit, auditable, and repo-relative.
- The dashboard is a local control plane, not a second durable state store.

## Forbidden shortcuts

- stubbed adapter surfaces that pretend the real runtime exists
- fabricated verification evidence or implied proof without links
- undocumented production-only toggles that bypass the workflow contract
- absolute machine paths in durable workflow artifacts
- second durable execution databases or hidden background ledgers
- bypassing task / prompt / run-request contracts with ad hoc UI-only state
- turning the project into a generic chat shell
