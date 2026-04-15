# T-304 - Codex MCP support — add Codex as mcp:install target and document TOML config integration

## Goal

Extend `mcp:install` / `mcp:uninstall` to support Codex as a first-class target. Codex stores MCP server configuration in TOML format (`~/.codex/config.toml` or trusted project-level `.codex/config.toml`), unlike Claude Code and Cursor. After this task, `mcp:install --client codex` writes the correct TOML config entry so Codex can call agent-workflow-studio's MCP tools directly and complete the three-client MCP integration story.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/mcp-install.js
  - repo path: src/cli.js
  - repo path: test/mcp-install.test.js
  - repo path: test/cli.test.js
  - repo path: README.md
  - repo path: docs/MCP_SETUP.md
  - repo path: AGENT_GUIDE.md
  - repo path: .agent-workflow/memory/architecture.md
  - repo path: .agent-workflow/tasks/T-304/task.md
  - repo path: .agent-workflow/tasks/T-304/context.md
  - repo path: .agent-workflow/tasks/T-304/verification.md
- Out of scope:
  - repo path: src/mcp-server.js
  - repo path: dashboard/

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 2 context)
- Codex MCP documentation (https://developers.openai.com/codex/mcp)
- Codex configuration basics (https://developers.openai.com/codex/config)

## Deliverables

- `mcp:install --client codex` writes an MCP server entry to `~/.codex/config.toml`
- `mcp:uninstall --client codex` removes the entry
- Lightweight TOML parser/writer with no external dependency
- Auto-detect includes Codex when `~/.codex/config.toml` already exists
- Unit tests covering TOML read/write, merge without corruption, idempotent install, clean uninstall, and CLI help text
- `docs/MCP_SETUP.md` updated with Codex-specific auto-install and manual TOML config guidance
- README updated with the three-client MCP setup summary
- Workflow docs refreshed with verification evidence and checkpoint updates

## Risks

- TOML parsing without a library only handles the subset needed for `[mcp_servers]` entries, so unusual TOML constructs must remain untouched rather than rewritten.
- `~/.codex/config.toml` may contain unrelated Codex settings that must be preserved exactly during merge.
- Codex supports trusted project-level `.codex/config.toml`, but this task intentionally limits automation to the global config.
- Windows paths require escaped backslashes in TOML basic strings; install and tests must handle that correctly.

## Acceptance Criteria

- `npx agent-workflow mcp:install --client codex` writes a valid TOML entry to `~/.codex/config.toml`
- `npx agent-workflow mcp:uninstall --client codex` removes the entry without corrupting other config
- Running install twice does not duplicate the entry
- Existing `~/.codex/config.toml` content is preserved during merge
- `mcp:install` auto-detect includes Codex when the config file exists
- All three clients work: `--client claude`, `--client cursor`, and `--client codex`
- TOML output is readable and valid
- `npm test`, `npm run lint`, and `npm run smoke` pass
- No runtime dependencies are added
