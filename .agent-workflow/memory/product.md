# Product Memory

## Product truth

- Agent runs often lack durable task context, trustworthy verification, and clean handoff state; this project provides a local-first workflow layer that keeps those artifacts in the repository.
- Verification, proof freshness, run evidence, and checkpoint state must never be faked or silently inferred from vibes.
- The product should make tasks compile into strong prompts, make runs leave evidence, refresh docs/checkpoints from that evidence, and keep long jobs resumable across context compaction and handoff.

## Current constraints

- Technical constraints: zero-dependency Node.js, local-only execution, repo-relative durable artifacts, no absolute paths in workflow state, and no hidden durable database outside the repository.
- Compliance constraints: workflow state must stay inspectable in Git, evidence must remain human-reviewable, and onboarding should not require embedded cloud API calls.
- Operational constraints: support Codex and Claude Code through adapter contracts, preserve contract-first schemas, and improve onboarding without collapsing into a generic chat shell.

## Open questions

- How much of this repository's own `.agent-workflow/` state should stay committed as dogfooding expands?
- When should onboarding prompts diverge for Codex vs Claude Code instead of staying generic?
- What level of real-agent validation is required before publishing the package for broader external use?
