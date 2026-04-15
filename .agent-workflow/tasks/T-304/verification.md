# T-304 Verification

## Planned checks

- automated:
  - `npm test`
  - `npm run lint`
  - `npm run smoke`
- manual:
  - inspect generated Codex TOML output in unit coverage
  - confirm README and MCP setup docs describe Codex global TOML install correctly

## Proof links

### Proof 1

- Files:
- Check:
- Result:
- Artifact:

## Blocking gaps

- none after verification runs complete

## Evidence 2026-04-15T12:33:41.233Z

- Agent: manual
- Status: passed
- Scoped files covered: src/lib/mcp-install.js, src/cli.js, test/mcp-install.test.js, test/cli.test.js, README.md, docs/MCP_SETUP.md, AGENT_GUIDE.md, .agent-workflow/memory/architecture.md, .agent-workflow/tasks/T-304/task.md, .agent-workflow/tasks/T-304/context.md, .agent-workflow/tasks/T-304/verification.md
- Summary: Added Codex MCP install/uninstall support with TOML config handling and docs.
- Verification check: [passed] npm test
- Verification check: [passed] npm run lint
- Verification check: [passed] npm run smoke
- Verification check: [passed] manual Codex CLI install wrote ~/.codex/config.toml in tmp/manual-codex-home
- Verification check: [passed] manual Codex CLI uninstall removed the agent-workflow entry from tmp/manual-codex-home/.codex/config.toml

## Evidence 2026-04-15T12:34:43.292Z

- Agent: manual
- Status: passed
- Scoped files covered: .agent-workflow/tasks/T-304/task.md
- Summary: Tightened task scope entries to remove ambiguity after verification.
- Verification check: [passed] checkpoint scope ambiguity cleared
