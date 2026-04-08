# Runbook

## Standard loops

1. Run `scan` or `memory:bootstrap` whenever repository memory is missing, stale, or still scaffold-like.
2. Use `quick` for the common local flow, or use `task:new` / `prompt:compile` / `run:prepare` directly when you need tighter control.
3. Tighten `task.md`, `context.md`, and `verification.md` before execution so the prompt and proof expectations are specific.
4. Use `run:execute` for supported local adapters or `run:add` for manual evidence capture.
5. Refresh manual proof anchors when freeform proof becomes stable enough to trust across branch switches and handoffs.
6. Rebuild `checkpoint.md` before handoff so the next agent can resume from durable repo files.

## Verification expectations

- For this repository, run `npm test` and `npm run smoke` before landing meaningful workflow or dashboard changes.
- Link verification to scoped files with explicit checks and/or artifacts; generic notes are not enough.
- Treat manual proof anchors as an opt-in hardening step after human proof is strong and stable.
- Do not let exit codes alone imply task completion; unresolved risks and missing proof must stay explicit.
