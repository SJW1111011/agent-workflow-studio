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

## Evidence 2026-04-15T16:26:06.567Z

- Agent: manual
- Status: passed
- Scoped files covered: src/lib/mcp-install.js, test/mcp-install.test.js, docs/MCP_SETUP.md
- Summary: Claude Code review passed: Codex TOML mcp:install/uninstall, three-client support, idempotent, conflict handling, no new runtime deps
- Verification check: [passed] mcp:install --client codex writes valid TOML to ~/.codex/config.toml
- Verification check: [passed] Idempotent: second install returns unchanged
- Verification check: [passed] Uninstall removes entry without corrupting config
- Verification check: [passed] Three-client install (claude,cursor,codex) works in one call
- Verification check: [passed] TOML output handles Windows backslash paths
- Verification check: [passed] npm test passes (32 files, 156 tests)
- Verification check: [passed] No runtime dependencies added
